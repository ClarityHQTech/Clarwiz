"use client";
import React from 'react'
import { IoPricetagOutline } from "react-icons/io5";
import { HiOutlineBriefcase, HiOutlineChevronDoubleLeft, HiOutlineChevronDoubleRight, HiOutlineChevronRight, HiOutlineDocumentDuplicate, HiOutlineLink, HiOutlineSparkles, HiOutlineUserGroup } from "react-icons/hi2";
import { MdDashboard, MdOutlineCampaign } from 'react-icons/md';
import { useUser } from '@/context/UserContext';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import ActiveTenantIndicator from './ActiveTenantIndicator';
import BrandLockup from '@/components/brand/BrandLockup';
import { BRAND } from '@/lib/brandUi';
// import ContactUs from '../dialogs/ContactUs';

const getInitials = (name) => {
    if (!name?.trim()) return "?";
    const parts = name.trim().split(/\s+/);
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
};

const Sidebar = ({ collapsed = false, onToggleCollapse }) => {

    const user = useUser();
    const pathname = usePathname();

    const params = pathname.split('/')[1];
    const campaignsActive = pathname.startsWith('/campaigns');
    const assistActive =
      pathname === '/assist' ||
      pathname.startsWith('/assist/deal/') ||
      pathname.startsWith('/assist/lead/');
    const collateralsActive = pathname.startsWith('/assist/collaterals');
    const profileActive = params === 'profile';

  return (
    <div className='h-full flex flex-col p-3 overflow-y-auto no-scrollbar'>
        <div className='w-full shrink-0'>
            <div className={`flex w-full p-2 ${collapsed ? 'flex-col items-center gap-2' : 'items-center justify-between'}`}>
                <Link href={'/'} className={`flex items-center ${collapsed ? 'justify-center' : 'justify-start gap-2'}`}>
                    <img className='h-8 w-8 shrink-0 object-contain' src="/logo.svg" alt={BRAND.lockup} />
                    {!collapsed && <BrandLockup />}
                </Link>
                <button
                    onClick={onToggleCollapse}
                    className='hidden lg:inline-flex items-center justify-center rounded-md p-1.5 text-brand-secondary hover:bg-brand-ink/50'
                    aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
                    title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
                >
                    {collapsed ? <HiOutlineChevronDoubleRight size={18} /> : <HiOutlineChevronDoubleLeft size={18} />}
                </button>
            </div>
            <hr className='w-full border-brand-secondary/30 mt-2 mb-2' />
        </div>

        <div className={`flex-1 min-h-0 flex flex-col w-full text-white ${collapsed ? 'items-center' : 'items-start'}`}>
            <div className='flex flex-col gap-1 w-full'>
                {(user?.canAccessDashboard !== false) && (
                <LinkButton collapsed={collapsed} url='/dashboard' title='Dashboard' icon={<MdDashboard size={20}/>} active={params === 'dashboard'} />
                )}
                {user?.canAccessCampaignOutreach !== false && (
                <LinkButton collapsed={collapsed} url='/campaigns' title='Campaigns' icon={<MdOutlineCampaign size={20}/>} active={campaignsActive} />
                )}
                <LinkButton collapsed={collapsed} url='/assist' title='AE Assist' icon={<HiOutlineBriefcase size={20}/>} active={assistActive} />
                <LinkButton collapsed={collapsed} url='/assist/collaterals' title='Collaterals' icon={<HiOutlineDocumentDuplicate size={20}/>} active={collateralsActive} />
                <LinkButton collapsed={collapsed} url='/integrations' title='Integrations' icon={<HiOutlineLink size={20}/>} active={params === 'integrations'} />
                <LinkButton collapsed={collapsed} url='/context' title='Context' icon={<HiOutlineSparkles size={20}/>} active={params === 'context'} />
                {user?.canManageTeam ? (
                <LinkButton collapsed={collapsed} url='/teams' title='Team' icon={<HiOutlineUserGroup size={20}/>} active={params === 'teams'} />
                ) : null}
                <LinkButton collapsed={collapsed} url='/pricing' title='Pricing' icon={<IoPricetagOutline size={20}/>} active={params === 'pricing'} />
            </div>
        </div>

        <div className={`shrink-0 w-full mt-4 ${collapsed ? 'flex flex-col items-center' : ''}`}>
            <hr className='w-full border-brand-secondary/30 mb-2' />

            <ProfileLink collapsed={collapsed} active={profileActive} name={user?.name} />

            <ActiveTenantIndicator collapsed={collapsed} />

            {user?.isSuperadmin ? (
            <Link
                href="/admin/dashboard"
                className={`flex items-center mt-2 w-full rounded-lg bg-brand-sage/30 text-white text-xs font-medium hover:bg-brand-sage/40 transition-colors ${
                  collapsed ? "justify-center p-2" : "justify-between px-4 py-1.5"
                }`}
                title="Admin Panel"
            >
                {!collapsed ? <span>Admin Panel</span> : <span className='text-xs'>AP</span> }
                <HiOutlineChevronRight className="h-4 w-4 shrink-0" aria-hidden />
            </Link>
            ) : null}
        </div>
    </div>
  )
}

const ProfileLink = ({ collapsed, active, name }) => {
    const initials = getInitials(name);

    return (
        <Link
            href="/profile"
            title="Profile"
            className={`flex items-center w-full rounded-lg ${
                collapsed ? 'justify-center p-2' : 'gap-3 p-3'
            } ${active ? 'bg-brand-sage/30 text-white' : 'text-white hover:bg-brand-ink/40'}`}
        >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/10 text-sm font-medium text-white">
                {initials}
            </span>
            {!collapsed && (
                <div className="flex min-w-0 flex-1 items-center justify-between gap-2">
                    <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{name || "Profile"}</p>
                        <p className="text-xs text-white/60">profile</p>
                    </div>
                    <HiOutlineChevronRight className="h-4 w-4 shrink-0 text-white/60" aria-hidden />
                </div>
            )}
        </Link>
    );
};

const LinkButton = ({ url = '/', title = 'Home', icon, active, collapsed = false }) => (
    <Link
      href={url}
      title={title}
      className={`relative flex items-center w-full ${
        collapsed ? 'justify-center p-2' : 'gap-4 p-2'
      } ${active ? 'bg-brand-sage/30 text-white rounded-lg' : 'p-2 text-white hover:bg-brand-ink/40'}`}
    >
      <span className="flex h-5 w-5 shrink-0 items-center justify-center">
        {icon}
      </span>
      {!collapsed && title}
    </Link>
  );
  

export default Sidebar