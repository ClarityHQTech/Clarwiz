import React, { useState } from 'react'
import { Avatar, Button, Drawer, DrawerBody, DrawerCloseButton, DrawerContent, DrawerHeader, DrawerOverlay, HStack, VStack, useDisclosure, } from '@chakra-ui/react';
import { RiMenuFill } from 'react-icons/ri';
import { FaUserCircle } from 'react-icons/fa';
import { IoPricetagOutline, IoSettingsOutline } from 'react-icons/io5';
import { useUser } from '@/context/UserContext';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import Profile from '../dialogs/ProfileModal';
import ConfirmBox from '@/components/dialogs/ConfirmBox';
import { IoIosLogOut } from 'react-icons/io';
import { MdDashboard, MdOutlineCampaign } from 'react-icons/md';
// import ContactUs from '../dialogs/ContactUs';
import { signOut } from 'next-auth/react';

const MobileDashMenu = () => {

    const user = useUser();
    const pathname = usePathname();

    const params = pathname.split('/')[1];

    const { isOpen, onClose, onOpen } = useDisclosure();
    const profile = useDisclosure();
    const logout = useDisclosure();

    const logoutHandler = () => {
      logout.onClose();
      signOut({ callbackUrl: '/' });
  }

  return (
    <>

    <button onClick={onOpen} className='lg:hidden flex justify-center items-center bg-cyan-800 rounded-lg p-2 z-50 fixed top-6 right-6 text-lg shadow-lg shadow-gray-500/50'>
        <RiMenuFill size={22} className='text-white'/>
    </button>

    <Drawer placement="right" onClose={onClose} isOpen={isOpen}>
    <DrawerOverlay />
    <DrawerContent className='lg:hidden'>
        <DrawerHeader borderBottomWidth={'1px'} className="bg-gray-800">
        <div className="flex justify-between items-center">
            <Link className='flex items-center justify-start gap-2 w-full' href={'/'}>
            <img className='h-8' src="/logo_white.svg" alt="" />
            <h1 className='text-gray-100 font-bold text-xl'>Services</h1>
            </Link>
            <DrawerCloseButton className="text-gray-400 border-2 border-gray-400" />
        </div>
        </DrawerHeader>

        <DrawerBody className='bg-gray-800'>
        <VStack spacing={'4'} alignItems="flex-start">
            <LinkButton icon={<MdDashboard size={20}/>} active={params === 'dashboard' ? true :false} onClose={onClose} url="/dashboard" title="Dashboard" />
            <LinkButton icon={<MdOutlineCampaign size={20}/>} active={params === 'campaigns' ? true :false} onClose={onClose} url="/campaigns" title="Campaigns" />
            <LinkButton icon={<IoSettingsOutline size={20}/>} active={params === 'settings' ? true :false} onClose={onClose} url="/settings" title="Settings" />
            <LinkButton icon={<IoPricetagOutline size={20}/>} active={params === 'pricing' ? true :false} onClose={onClose} url="/pricing" title="Pricing" />

            <HStack
            position="absolute"
            bottom={'2rem'}
            width="80%"
            >
            <div>
                <button onClick={logout.onOpen} className='flex items-center gap-2 p-4 cursor-pointer text-white font-semibold'>
                    <IoIosLogOut className='' size={25} />
                    Logout
                </button>
                <button onClick={profile.onOpen} className='flex items-center gap-2 p-4 cursor-pointer text-white font-semibold'>
                    <FaUserCircle className='' size={25} />
                    Profile
                </button>
            </div>

            <Profile isOpen={profile.isOpen} onClose={profile.onClose} user={user}/>
            <ConfirmBox isOpen={logout.isOpen} onClose={logout.onClose} action="Logout" handler={logoutHandler}/>
            </HStack>
        </VStack>
        </DrawerBody>
    </DrawerContent>
    </Drawer>


    </>
  )
}

const LinkButton = ({ url = '/', title = 'Home', onClose, active, icon }) => (
    <Link className='relative' onClick={onClose} href={url}>
      <div className={`flex items-center gap-4 w-full text-white rounded-md p-2 px-4 font-semibold ${active ? 'bg-cyan-600/40' : ''}`}> {icon} {title}</div>
    </Link>
  );


export default MobileDashMenu