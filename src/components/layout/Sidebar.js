"use client";
import React from 'react'
import { FaUserCircle } from 'react-icons/fa';
import { IoPricetagOutline, IoSettingsOutline } from "react-icons/io5";
import { MdDashboard, MdOutlineCampaign } from 'react-icons/md';
import { IoIosLogOut } from "react-icons/io";
import { HiOutlineChevronDoubleLeft, HiOutlineChevronDoubleRight } from "react-icons/hi2";
import { useDisclosure } from '@chakra-ui/react';
import { useUser } from '@/context/UserContext';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import Profile from '../dialog/ProfileModal';
import ConfirmBox from '../dialog/ConfirmBox';
import { signOut } from 'next-auth/react';
// import ContactUs from '../dialogs/ContactUs';

const Sidebar = ({ collapsed = false, onToggleCollapse }) => {

    const user = useUser();
    const pathname = usePathname();
    const profile = useDisclosure();
    const logout = useDisclosure();

    const logoutHandler = () => {
        logout.onClose();
        signOut({ callbackUrl: '/' });
    }

    const params = pathname.split('/')[1];

  return (
    <div className='h-[100vh] flex flex-col justify-between p-3'>
        <div className='w-full'>
            <div className='flex items-center justify-between h-[5vh] w-full p-2 pb-4'>
                <Link href={'/'} className={`flex items-center ${collapsed ? 'justify-center w-full' : 'justify-start gap-2'}`}>
                    <img className='h-8' src="/logo.svg" alt="ClarWiz logo" />
                    {!collapsed && (
                        <h1 className='font-semibold text-lg text-gray-200'>ClarWiz</h1>
                    )}
                </Link>
                <button
                    onClick={onToggleCollapse}
                    className='hidden lg:inline-flex items-center justify-center rounded-md p-1.5 text-gray-100 hover:bg-sky-700/80'
                    aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
                    title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
                >
                    {collapsed ? <HiOutlineChevronDoubleRight size={18} /> : <HiOutlineChevronDoubleLeft size={18} />}
                </button>
            </div>
        </div>
        <div className={`h-[90vh] flex flex-col justify-between w-full text-white ${collapsed ? 'items-center' : 'items-start'}`}>
            <div className='flex flex-col gap-4 w-full'>
                <LinkButton collapsed={collapsed} url='/dashboard' title='Dashboard' icon={<MdDashboard size={20}/>} active={params === 'dashboard'} />
                <LinkButton collapsed={collapsed} url='/campaigns' title='Campaigns' icon={<MdOutlineCampaign size={25}/>} active={params === 'campaigns'} />
                <LinkButton collapsed={collapsed} url='/settings' title='Settings' icon={<IoSettingsOutline size={20}/>} active={params === 'settings'} />
                <LinkButton collapsed={collapsed} url='/pricing' title='Pricing' icon={<IoPricetagOutline size={20}/>} active={params === 'pricing'} />
            </div>

            <div className='w-full'>
                <button
                    onClick={logout.onOpen}
                    className={`flex items-center w-full cursor-pointer ${collapsed ? 'justify-center p-2.5' : 'gap-2 p-4'}`}
                    title='Logout'
                >
                    <IoIosLogOut className='text-white' size={25} />
                    {!collapsed && "Logout"}
                </button>
                <button
                    onClick={profile.onOpen}
                    className={`flex items-center w-full cursor-pointer ${collapsed ? 'justify-center p-2.5' : 'gap-2 p-4'}`}
                    title='Profile'
                >
                    <FaUserCircle className='text-white' size={25} />
                    {!collapsed && "Profile"}
                </button>
            </div>

        </div>

        <Profile isOpen={profile.isOpen} onClose={profile.onClose} user={user}/>
        <ConfirmBox isOpen={logout.isOpen} onClose={logout.onClose} action="Logout" handler={logoutHandler}/>

    </div>
  )
}

const LinkButton = ({ url = '/', title = 'Home', icon, active, collapsed = false }) => (
    <Link
      href={url}
      title={title}
      className={`relative flex items-center w-full ${
        collapsed ? 'justify-center' : 'gap-4'
      } ${active ? 'p-2 bg-white text-sky-800 rounded-lg' : 'p-2'}`}
    >
      {icon}
      {!collapsed && title}
    </Link>
  );
  

export default Sidebar