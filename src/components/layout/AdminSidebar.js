"use client";
import React, { useEffect, useState } from 'react'
import { FaLinkedin, FaRobot, FaStackOverflow, FaUserCircle } from 'react-icons/fa';
import { IoFolderOpenOutline, IoPricetagOutline, IoSearchSharp, IoFolderOutline, IoChevronDownSharp, IoImage, IoCalendarOutline } from "react-icons/io5";
import { GrSend } from "react-icons/gr"; //
import { ImProfile } from "react-icons/im";
import { LuFolderClosed, LuFolderMinus, LuFolderOpen, LuWorkflow } from "react-icons/lu";
import { VscGitPullRequest, VscSaveAll } from "react-icons/vsc";
import { MdDashboard, MdManageHistory, MdOutlineCampaign, MdOutlineRateReview } from 'react-icons/md';
import { RiAlignItemBottomFill } from "react-icons/ri";
import { IoIosLogOut } from "react-icons/io";
import { FiUsers } from "react-icons/fi";
import { useDisclosure } from '@chakra-ui/react';
import { useUser } from '@/context/UserContext';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { signOut } from 'next-auth/react';

const AdminSidebar = () => {

    const user = useUser();
    const pathname = usePathname();
    const logout = useDisclosure();

    const logoutHandler = () => {
        logout.onClose();
        signOut({ callbackUrl: '/' });
    }

    const params = pathname.split('/')[2];

  return (
    <div className='h-[100vh] flex flex-col items-start justify-between p-3'>
        <Link href={'/'} className='flex items-center justify-start gap-2 h-[5vh] w-full p-2 pb-4'>
            <img className='h-8' src="/logo_white.svg" alt="" />
            <h1 className='font-semibold text-lg text-gray-200'>Admin Panel</h1>
        </Link>
        <div className='h-[90vh] flex flex-col items-start justify-between w-full text-white'>
            <div className='flex flex-col gap-4 w-full'>
                <LinkButton url='/admin/dashboard' title='Dashboard' icon={<MdDashboard size={20}/>} active={params === 'dashboard'} />
                <LinkButton url='/admin/clients' title='Users' icon={<FiUsers size={20}/>} active={params === 'clients'} />
            </div>

            <div>
                {/* <button onClick={logout.onOpen} className='flex items-center gap-2 p-4 cursor-pointer'>
                    <IoIosLogOut className='text-white' size={25} />
                    Logout
                </button>
                <button onClick={profile.onOpen} className='flex items-center gap-2 p-4 cursor-pointer'>
                    <FaUserCircle className='text-white' size={25} />
                    Profile
                </button> */}
            </div>

        </div>

    </div>
  )
}

const LinkButton = ({ url = '/', title = 'Home', icon, active }) => (
    <Link href={url} className={`relative flex items-center gap-4 ${active ? 'p-2 bg-gradient-to-tr from-cyan-500/90 to-cyan-100/30 rounded-lg' : 'p-2'}`}>
      {icon}
      {title}
    </Link>
  );
  

export default AdminSidebar