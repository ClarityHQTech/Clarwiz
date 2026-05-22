"use client";
import React, { useEffect, useState } from 'react'
import { FaUserCircle } from 'react-icons/fa';
import { IoPricetagOutline, IoSettingsOutline } from "react-icons/io5";
import { MdDashboard, MdOutlineCampaign } from 'react-icons/md';
import { IoIosLogOut } from "react-icons/io";
import { useDisclosure } from '@chakra-ui/react';
import { useUser } from '@/context/UserContext';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import Profile from '../dialogs/ProfileModal';
import ConfirmBox from '../dialogs/ConfirmBox';
import { signOut } from 'next-auth/react';
// import ContactUs from '../dialogs/ContactUs';

const Sidebar = () => {

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
    <div className='h-[100vh] flex flex-col items-start justify-between p-3'>
        <Link href={'/'} className='flex items-center justify-start gap-2 h-[5vh] w-full p-2 pb-4'>
            <img className='h-8 ' src="/logo.svg " alt="" />
            <h1 className='font-semibold text-lg text-gray-200'>GTM Engine</h1>
        </Link>
        <div className='h-[90vh] flex flex-col items-start justify-between w-full text-white'>
            <div className='flex flex-col gap-4 w-full'>
                <LinkButton url='/dashboard' title='Dashboard' icon={<MdDashboard size={20}/>} active={params === 'dashboard'} />
                <LinkButton url='/campaigns' title='Campaigns' icon={<MdOutlineCampaign size={25}/>} active={params === 'campaigns'} />
                <LinkButton url='/settings' title='Settings' icon={<IoSettingsOutline size={20}/>} active={params === 'settings'} />
                <LinkButton url='/pricing' title='Pricing' icon={<IoPricetagOutline size={20}/>} active={params === 'pricing'} />
            </div>

            <div>
                <button onClick={logout.onOpen} className='flex items-center gap-2 p-4 cursor-pointer'>
                    <IoIosLogOut className='text-white' size={25} />
                    Logout
                </button>
                <button onClick={profile.onOpen} className='flex items-center gap-2 p-4 cursor-pointer'>
                    <FaUserCircle className='text-white' size={25} />
                    Profile
                </button>
            </div>

        </div>

        <Profile isOpen={profile.isOpen} onClose={profile.onClose} user={user}/>
        <ConfirmBox isOpen={logout.isOpen} onClose={logout.onClose} action="Logout" handler={logoutHandler}/>

    </div>
  )
}

const LinkButton = ({ url = '/', title = 'Home', icon, active }) => (
    <Link href={url} className={`relative flex items-center gap-4 ${active ? 'p-2 bg-white text-sky-800 rounded-lg' : 'p-2'}`}>
      {icon}
      {title}
    </Link>
  );
  

export default Sidebar