import React from "react"
import { useAtomValue, useSetAtom } from "jotai"
import { drawerStackAtom, closeDrawerAtom } from "../../atoms/drawerState"
import Drawer from "./Drawer"
import Settings from "../../views/Drawer/Settings"
import IntegrationMarket from "../../views/Drawer/IntegrationMarket"
import { useTranslation } from "react-i18next"

const DrawerPortal: React.FC = () => {
  const { t } = useTranslation()
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
            title = t("sidebar.manageAndSettings")
            break
          case "IntegrationMarket":
            content = <IntegrationMarket 
              {...(drawer.props || {})} 
              onClose={() => closeDrawer(drawer.id)}
            />
            title = t("sidebar.integrationMarket") || "Integration Market"
            break
          default:
            content = <div>Unknown drawer: {drawer.page}</div>
            title = t("sidebar.unknownPage") || "Unknown Page"
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
