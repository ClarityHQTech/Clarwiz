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
import { IoPricetagOutline } from "react-icons/io5";
import { HiOutlineChevronRight, HiOutlineLink, HiOutlineSparkles, HiOutlineUserGroup } from "react-icons/hi2";
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
  const campaignsActive = pathname.startsWith("/campaigns");
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
                <div className={ui.mobileDrawerTitle}>
                  <span className="font-serif font-semibold">{BRAND.productName}</span>
                  <span className="block text-xs font-sans text-brand-secondary font-normal">
                    by {BRAND.parentBrand}
                  </span>
                </div>
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
                  active={campaignsActive}
                  onClose={onClose}
                  url="/campaigns"
                  title="Campaigns"
                />
              )}
              <LinkButton
                icon={<HiOutlineLink size={20} />}
                active={params === "integrations"}
                onClose={onClose}
                url="/integrations"
                title="Integrations"
              />
              <LinkButton
                icon={<HiOutlineSparkles size={20} />}
                active={params === "context"}
                onClose={onClose}
                url="/context"
                title="Context"
              />
              {user?.canManageTeam ? (
              <LinkButton
                icon={<HiOutlineUserGroup size={20} />}
                active={params === "teams"}
                onClose={onClose}
                url="/teams"
                title="Team"
              />
              ) : null}
              <LinkButton
                icon={<IoPricetagOutline size={20} />}
                active={params === "pricing"}
                onClose={onClose}
                url="/pricing"
                title="Pricing"
              />

              <HStack position="absolute" bottom="2rem" width="80%">
                <div className="w-full">
                  {user?.isSuperadmin ? (
                  <Link
                    href="/admin/dashboard"
                    onClick={onClose}
                    className="flex items-center justify-between w-full rounded-lg bg-brand-sage text-brand-ink px-4 py-2.5 text-sm font-medium hover:bg-brand-sage/90 transition-colors mb-2"
                  >
                    <span>Admin Panel</span>
                    <HiOutlineChevronRight className="h-4 w-4 shrink-0" aria-hidden />
                  </Link>
                  ) : null}
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
