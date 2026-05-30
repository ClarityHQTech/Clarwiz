"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { MdDashboard } from "react-icons/md";
import { FiUsers } from "react-icons/fi";
import { HiOutlineWrenchScrewdriver } from "react-icons/hi2";
import { FaBuildingUser } from "react-icons/fa6";
import { BRAND } from "@/lib/brandUi";

const AdminSidebar = () => {
  const pathname = usePathname();
  const params = pathname.split("/")[2];

  return (
    <div className="h-[100vh] flex flex-col items-start justify-between p-3">
      <Link
        href="/"
        className="flex items-center justify-start gap-2 h-[5vh] w-full p-2 pb-4"
      >
        <img className="h-8" src="/logo.svg" alt={BRAND.lockup} />
        <h1 className="font-semibold text-lg text-brand-bg">Admin Panel</h1>
      </Link>
      <div className="h-[90vh] flex flex-col items-start justify-between w-full text-white">
        <div className="flex flex-col gap-4 w-full">
          <LinkButton
            url="/admin/dashboard"
            title="Dashboard"
            icon={<MdDashboard size={20} />}
            active={params === "dashboard"}
          />
          <LinkButton
            url="/admin/users"
            title="Users"
            icon={<FiUsers size={20} />}
            active={params === "users"}
          />
          <LinkButton
            url="/admin/manage"
            title="Tenants"
            icon={<FaBuildingUser size={20} />}
            active={params === "manage"}
          />
        </div>
      </div>
    </div>
  );
};

const LinkButton = ({ url = "/", title = "Home", icon, active }) => (
  <Link
    href={url}
    className={`relative flex items-center gap-4 ${
      active ? "p-2 bg-brand-sage/30 text-white rounded-lg" : "p-2 hover:bg-brand-ink/40"
    }`}
  >
    {icon}
    {title}
  </Link>
);

export default AdminSidebar;
