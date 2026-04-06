import os
import json
import requests
from typing import Any, Dict

from flask import Flask, request, jsonify, Response

from llm_wrapper import CurlLLM





# Define upstream URL and bearer token directly in code (no need to export env vars)
UPSTREAM_URL = "https://moss.starbucks.net/v1/chat/completions"
# If you also want to proxy /v1/models, define the upstream models URL here
UPSTREAM_MODELS_URL = "https://moss.starbucks.net/v1/models"
USE_CURL = os.getenv("USE_CURL", "").lower() == "true"
# Replace the placeholder token below with your real bearer token
UPSTREAM_AUTH =  "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJmcmVzaCI6dHJ1ZSwiaWF0IjoxNzYxODA5MTI3LCJqdGkiOiI5M2ViYjk0MC1lZjZmLTQ0YjktOWU4MC01M2I2M2IwMjAzY2IiLCJ0eXBlIjoiYWNjZXNzIiwic3ViIjoiODQiLCJuYmYiOjE3NjE4MDkxMjcsImV4cCI6NDEwMjM4MzIzNn0.z4egpF9WcLuFcwPF0YWP6g4Kpb9SJDGzjtZ1e0nxt3Q"
PORT = int(os.getenv("PORT", "8001"))
# How long to wait for upstream responses (seconds). Default to 120s to allow longer model compute.
UPSTREAM_TIMEOUT = int(os.getenv("UPSTREAM_TIMEOUT", "120"))

headers = {}
if UPSTREAM_AUTH:
    headers["Authorization"] = UPSTREAM_AUTH

llm = CurlLLM(upstream_url=UPSTREAM_URL, use_curl=USE_CURL, headers=headers, timeout=UPSTREAM_TIMEOUT)

app = Flask(__name__)


def forward_and_parse(body_json: Dict[str, Any]):
    # forward as JSON string
    out = llm.forward_json(body_json)
    # If upstream returned parsed JSON, return it directly
    if isinstance(out, dict) or isinstance(out, list):
        return out
    # if it's a string, try to parse
    try:
        return json.loads(out)
    except Exception:
        # Wrap plain text into an OpenAI-compatible minimal response
        return {
            "id": "wrapped-1",
            "object": "chat.completion",
            "choices": [
                {"message": {"role": "assistant", "content": str(out)}, "finish_reason": "stop"}
            ],
        }


@app.route("/v1/chat/completions", methods=["POST"])
def chat_completions():
    body = request.get_json(force=True, silent=True) or {}
    # Default to non-streaming responses unless the client explicitly sets "stream": true
    body["stream"]=False
    # Ensure chat_template_kwargs exists and merge forced settings (do not overwrite client-provided keys)
    body.setdefault("chat_template_kwargs", {})
    forced_chat_kwargs = {"enable_thinking": False, "max_position_embeddings": 40961}
    body["chat_template_kwargs"].update(forced_chat_kwargs)
    # Also set top-level max_position_embeddings consistently
    body["max_position_embeddings"] = 40932
    # Also set a top-level convenience flag so clients can more easily detect thinking state
    body["enable_thinking"] = False

    # If client requests streaming, proxy the upstream stream and convert to OpenAI SSE format
    if body.get("stream"):
        def stream_generator():
            import subprocess as _subprocess

            # prepare curl command to post JSON and stream output
            body_text = json.dumps(body, ensure_ascii=False)
            cmd = ["curl", "-sS", "-N", "-X", "POST", UPSTREAM_URL, "-H", "Content-Type: application/json", "-d", body_text]

            # forward auth/custom headers
            for k, v in (headers or {}).items():
                cmd.extend(["-H", f"{k}: {v}"])

            # support custom CA bundle or insecure option
            ca_bundle = os.getenv("REQUESTS_CA_BUNDLE")
            if ca_bundle:
                cmd.extend(["--cacert", ca_bundle])
            elif os.getenv("CURL_INSECURE", "").lower() == "true":
                cmd.append("-k")

            try:
                proc = _subprocess.Popen(cmd, stdout=_subprocess.PIPE, stderr=_subprocess.PIPE, text=True, bufsize=1)
            except FileNotFoundError:
                yield f"data: {json.dumps({'error': 'curl not found on system'})}\n\n"
                return
            except Exception as e:
                yield f"data: {json.dumps({'error': str(e)})}\n\n"
                return

            try:
                # Emit an initial event notifying the client this upstream supports tools
                init_meta = {"model_capabilities": {"tools": True}, "enable_thinking": False}
                yield f"data: {json.dumps(init_meta, ensure_ascii=False)}\n\n"
                # Read stdout line by line as they arrive
                while True:
                    line = proc.stdout.readline()
                    if line == "":
                        # check if process finished
                        if proc.poll() is not None:
                            break
                        continue
                    line = line.rstrip("\n")
                    if not line:
                        continue

                    # If upstream already emits 'data:' SSE lines, pass through
                    if line.startswith("data:"):
                        yield line + "\n\n"
                        continue

                    # Try to parse JSON and map to OpenAI streaming shape
                    try:
                        parsed = json.loads(line)
                    except Exception:
                        parsed = None

                    if isinstance(parsed, dict):
                        if "choices" in parsed:
                            yield f"data: {json.dumps(parsed)}\n\n"
                        else:
                            chunk = {"id": parsed.get("id", ""), "object": "chat.completion.chunk", "choices": [{"delta": {"content": parsed.get("text") or parsed.get("message") or parsed}, "index": 0, "finish_reason": None}]}
                            yield f"data: {json.dumps(chunk)}\n\n"
                    else:
                        chunk = {"id": "", "object": "chat.completion.chunk", "choices": [{"delta": {"content": line}, "index": 0, "finish_reason": None}]}
                        yield f"data: {json.dumps(chunk)}\n\n"

                # wait for process to finish and check for errors
                proc.wait(timeout=1)
                stderr = proc.stderr.read().strip()
                if proc.returncode != 0:
                    yield f"data: {json.dumps({'error': stderr or 'upstream curl failed'})}\n\n"
                    return

                # final done sentinel
                yield "data: [DONE]\n\n"

            except GeneratorExit:
                try:
                    proc.kill()
                except Exception:
                    pass
                return
            except Exception as e:
                try:
                    proc.kill()
                except Exception:
                    pass
                yield f"data: {json.dumps({'error': str(e)})}\n\n"

        resp = Response(stream_generator(), mimetype="text/event-stream")
        resp.headers["X-Model-Tool-Support"] = "true"
        resp.headers["X-Enable-Thinking"] = "false"
        return resp

    # Non-streaming path: forward and return parsed JSON
    resp_json = forward_and_parse(body)
    # Inject capability hint and thinking flag so clients can detect tool support and thinking state
    if isinstance(resp_json, dict):
        resp_json.setdefault("model_capabilities", {})["tools"] = True
        resp_json.setdefault("enable_thinking", False)
    flask_resp = jsonify(resp_json)
    flask_resp.headers["X-Model-Tool-Support"] = "true"
    flask_resp.headers["X-Enable-Thinking"] = "false"
    return flask_resp


@app.route("/v1/completions", methods=["POST"])
def completions():
    body = request.get_json(force=True, silent=True) or {}
    # Ensure chat_template_kwargs exists and merge forced settings (do not overwrite client-provided keys)
    body.setdefault("chat_template_kwargs", {})
    forced_chat_kwargs = {"enable_thinking": False, "max_position_embeddings": 40961}
    body["chat_template_kwargs"].update(forced_chat_kwargs)
    body["max_position_embeddings"] = 40932
    body["enable_thinking"] = False
    resp_json = forward_and_parse(body)
    if isinstance(resp_json, dict):
        resp_json.setdefault("model_capabilities", {})["tools"] = True
        resp_json.setdefault("enable_thinking", False)
    flask_resp = jsonify(resp_json)
    flask_resp.headers["X-Model-Tool-Support"] = "true"
    flask_resp.headers["X-Enable-Thinking"] = "false"
    return flask_resp


@app.route("/", methods=["GET"])
def hello():
    return jsonify({"ok": True, "upstream": UPSTREAM_URL, "use_curl": USE_CURL})


@app.route("/v1/models", methods=["GET"])
def models():
    """Forward GET /v1/models to the upstream models endpoint and return JSON/text."""
    import subprocess
    try:
        # Build curl command to leverage system trust store (useful when curl works but requests fails)
        cmd = ["curl", "-sS", "-X", "GET", UPSTREAM_MODELS_URL]
        # Add headers
        for k, v in (headers or {}).items():
            cmd.extend(["-H", f"{k}: {v}"])

        # If a CA bundle is specified, use it via --cacert; else respect CURL_INSECURE
        ca_bundle = os.getenv("REQUESTS_CA_BUNDLE")
        if ca_bundle:
            cmd.extend(["--cacert", ca_bundle])
        elif os.getenv("CURL_INSECURE", "").lower() == "true":
            cmd.append("-k")

        proc = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
        out = proc.stdout.decode("utf-8", errors="replace").strip()
        err = proc.stderr.decode("utf-8", errors="replace").strip()

        if proc.returncode != 0:
            # include stderr for debugging
            return jsonify({"error": f"curl failed: {err or out}"}), 502

        # Try to parse JSON
        try:
            parsed = json.loads(out)
            # inject model capability and thinking flag for clients
            if isinstance(parsed, dict):
                parsed.setdefault("model_capabilities", {})["tools"] = True
                parsed.setdefault("enable_thinking", False)
            flask_resp = jsonify(parsed)
            flask_resp.headers["X-Model-Tool-Support"] = "true"
            flask_resp.headers["X-Enable-Thinking"] = "false"
            return flask_resp
        except Exception:
            resp = Response(out, status=200, mimetype="application/json")
            resp.headers["X-Model-Tool-Support"] = "true"
            resp.headers["X-Enable-Thinking"] = "false"
            return resp

    except FileNotFoundError:
        return jsonify({"error": "curl not found on system. Install curl or use requests-based proxy."}), 500
    except Exception as e:
        return jsonify({"error": str(e)}), 502


if __name__ == "__main__":
    # Development server
    app.run(host="0.0.0.0", port=PORT)
