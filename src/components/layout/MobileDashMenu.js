import React from "react";
import {
  Drawer,
  DrawerBody,
  DrawerCloseButton,
  DrawerContent,
  DrawerHeader,
  DrawerOverlay,
  HStack,
  VStack,
  useDisclosure,
} from "@chakra-ui/react";
import { RiMenuFill } from "react-icons/ri";
import { FaUserCircle } from "react-icons/fa";
import { IoPricetagOutline, IoSettingsOutline } from "react-icons/io5";
import { usePathname } from "next/navigation";
import Link from "next/link";
import ConfirmBox from "@/components/dialog/ConfirmBox";
import { IoIosLogOut } from "react-icons/io";
import { MdDashboard, MdOutlineCampaign } from "react-icons/md";
import { signOut } from "next-auth/react";
import ActiveTenantIndicator from "./ActiveTenantIndicator";
import { useUser } from "@/context/UserContext";
import { BRAND, ui } from "@/lib/brandUi";

const MobileDashMenu = () => {
  const user = useUser();
  const pathname = usePathname();
  const params = pathname.split("/")[1];
  const { isOpen, onClose, onOpen } = useDisclosure();
  const logout = useDisclosure();

  const logoutHandler = () => {
    logout.onClose();
    signOut({ callbackUrl: "/" });
  };

  return (
    <>
      <button
        type="button"
        onClick={onOpen}
        className={`${ui.mobileFab} fixed top-6 right-6 left-auto z-50`}
        aria-label="Open menu"
      >
        <RiMenuFill size={22} className="text-brand-bg" />
      </button>

      <Drawer placement="right" onClose={onClose} isOpen={isOpen}>
        <DrawerOverlay />
        <DrawerContent className="lg:hidden">
          <DrawerHeader borderBottomWidth="1px" className={ui.mobileDrawerHeader}>
            <div className="flex justify-between items-center">
              <Link
                className="flex items-center justify-start gap-2 w-full"
                href="/"
                onClick={onClose}
              >
                <img className="h-8" src="/logo_white.svg" alt="" />
                <h1 className={ui.mobileDrawerTitle}>{BRAND.displayName}</h1>
              </Link>
              <DrawerCloseButton className={ui.mobileCloseBtn} />
            </div>
          </DrawerHeader>

          <DrawerBody className={ui.mobileDrawerBody}>
            <VStack spacing="4" alignItems="flex-start">
              {(user?.canAccessDashboard !== false) && (
                <LinkButton
                  icon={<MdDashboard size={20} />}
                  active={params === "dashboard"}
                  onClose={onClose}
                  url="/dashboard"
                  title="Dashboard"
                />
              )}
              {user?.canAccessCampaignOutreach !== false && (
                <LinkButton
                  icon={<MdOutlineCampaign size={20} />}
                  active={params === "campaigns"}
                  onClose={onClose}
                  url="/campaigns"
                  title="Campaigns"
                />
              )}
              <LinkButton
                icon={<IoSettingsOutline size={20} />}
                active={params === "settings"}
                onClose={onClose}
                url="/settings"
                title="Settings"
              />
              <LinkButton
                icon={<IoPricetagOutline size={20} />}
                active={params === "pricing"}
                onClose={onClose}
                url="/pricing"
                title="Pricing"
              />

              <HStack position="absolute" bottom="2rem" width="80%">
                <div className="w-full">
                  <button
                    type="button"
                    onClick={logout.onOpen}
                    className="flex items-center gap-2 p-4 cursor-pointer text-brand-bg font-medium"
                  >
                    <IoIosLogOut size={25} />
                    Logout
                  </button>
                  <LinkButton
                    icon={<FaUserCircle size={20} />}
                    active={params === "profile"}
                    onClose={onClose}
                    url="/profile"
                    title="Profile"
                  />
                  {user && !user.isSuperadmin ? (
                    <div className="w-full px-2 mt-2">
                      <ActiveTenantIndicator />
                    </div>
                  ) : null}
                </div>
                <ConfirmBox
                  isOpen={logout.isOpen}
                  onClose={logout.onClose}
                  action="Logout"
                  handler={logoutHandler}
                />
              </HStack>
            </VStack>
          </DrawerBody>
        </DrawerContent>
      </Drawer>
    </>
  );
};

const LinkButton = ({ url = "/", title = "Home", onClose, active, icon }) => (
  <Link className="relative w-full" onClick={onClose} href={url}>
    <div
      className={`${ui.mobileNavItem} ${active ? ui.mobileNavItemActive : "hover:bg-brand-ink/40"}`}
    >
      {icon}
      {title}
    </div>
  </Link>
);

export default MobileDashMenu;
