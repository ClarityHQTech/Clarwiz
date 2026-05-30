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
import { usePathname } from "next/navigation";
import Link from "next/link";
import { MdDashboard } from "react-icons/md";
import { FiUsers } from "react-icons/fi";
import { FaBuildingUser } from "react-icons/fa6";
import { ui } from "@/lib/brandUi";

const AdminMobileMenu = () => {
  const pathname = usePathname();
  const params = pathname.split("/")[2];
  const { isOpen, onClose, onOpen } = useDisclosure();

  return (
    <>
      <button
        type="button"
        onClick={onOpen}
        className={`${ui.mobileFab} fixed top-6 right-6 left-auto z-50`}
        aria-label="Open admin menu"
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
                href="/admin/dashboard"
                onClick={onClose}
              >
                <img className="h-8" src="/logo_white.svg" alt="" />
                <h1 className={ui.mobileDrawerTitle}>Admin</h1>
              </Link>
              <DrawerCloseButton className={ui.mobileCloseBtn} />
            </div>
          </DrawerHeader>

          <DrawerBody className={ui.mobileDrawerBody}>
            <VStack spacing="4" alignItems="flex-start">
              <LinkButton
                icon={<MdDashboard size={20} />}
                active={params === "dashboard"}
                onClose={onClose}
                url="/admin/dashboard"
                title="Dashboard"
              />
              <LinkButton
                icon={<FiUsers size={20} />}
                active={params === "users"}
                onClose={onClose}
                url="/admin/users"
                title="Users"
              />
              <LinkButton
                icon={<FaBuildingUser size={20} />}
                active={params === "manage"}
                onClose={onClose}
                url="/admin/manage"
                title="Tenants"
              />
              <HStack position="absolute" bottom="2rem" width="80%" />
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

export default AdminMobileMenu;
