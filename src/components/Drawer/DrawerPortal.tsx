import React from "react"
import { useAtomValue, useSetAtom } from "jotai"
import { drawerStackAtom, closeDrawerAtom } from "../../atoms/drawerState"
import Drawer from "./Drawer"
import Settings from "../../views/Drawer/Settings"
import IntegrationMarket from "../../views/Drawer/IntegrationMarket"

const DrawerPortal: React.FC = () => {
  const drawers = useAtomValue(drawerStackAtom)
  const closeDrawer = useSetAtom(closeDrawerAtom)

  return (
    <>
      {drawers.map((drawer) => {
        let content: React.ReactNode = null
        let title = ""

        switch (drawer.page) {
          case "Settings":
            content = <Settings tab={drawer.tab as any} />
            title = "管理与设置"
            break
          case "IntegrationMarket":
            content = <IntegrationMarket 
              {...(drawer.props || {})} 
              onClose={() => closeDrawer(drawer.id)}
            />
            title = "集成市场"
            break
          default:
            content = <div>Unknown drawer: {drawer.page}</div>
            title = "未知页面"
        }

        return (
          <Drawer
            key={drawer.id}
            visible={true}
            onClose={() => closeDrawer(drawer.id)}
            fullscreen={true}
            title={title}
          >
            {content}
          </Drawer>
        )
      })}
    </>
  )
}

export default DrawerPortal
