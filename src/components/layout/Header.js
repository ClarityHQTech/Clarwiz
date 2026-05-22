"use client";
import { Avatar, Button, Drawer, DrawerBody, DrawerCloseButton, DrawerContent, DrawerHeader, DrawerOverlay, HStack, VStack, useDisclosure, } from '@chakra-ui/react';
import { RiDashboardFill, RiLogoutBoxLine, RiMenu5Fill, RiMenuFill } from 'react-icons/ri';
import { AiOutlineDocker } from 'react-icons/ai';
import { FaRegArrowAltCircleRight } from "react-icons/fa";
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { signIn, useSession } from "next-auth/react";
import { useUser } from '@/context/UserContext';
// import ContactUs from '../dialogs/ContactUs';
import Loader from '../shared/Loader';


const Header = () => {

  const user = useUser()
  const contact = useDisclosure();

  const [scrolled, setScrolled] = useState(false);
  const params = usePathname();

  const isHome = params === '/';

  const { isOpen, onClose, onOpen } = useDisclosure();

  useEffect(() => {
    if (!isHome) {
      setScrolled(true);
      return;
    }

    const onScroll = () => {
      setScrolled(window.scrollY > 40);
    };

    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, [isHome]);


  const logoutHandler = () => {
    onClose();
    // dispatch(logout());
  };

  return user === undefined ? <Loader size={30} ringSize={50} fullScreen={true}/> : (
    <>

  <header className="fixed top-0 left-0 w-full z-50 hidden lg:block">
    <div
      className={`
        w-full px-6 py-4 flex items-center justify-between
        transition-all duration-300
        ${
          scrolled
            ? "bg-white/80 backdrop-blur-md shadow-md"
            : "bg-transparent"
        }
      `}
    >
      <div className="flex gap-16 items-center">
        <Link className='flex gap-2 items-center' href="/">
          <img src='/logo.svg' className='h-8'/>
          <h1
            className={`
              font-bold text-xl transition-colors duration-300
              ${scrolled ? "text-sky-700" : "text-sky-700"}
            `}
          >
            GTM <span className="text-sky-700">Engine</span>
          </h1>
        </Link>
      </div>

      <div
        className={`
          flex items-center gap-8 transition-colors duration-300
          ${scrolled ? "text-gray-800" : "text-gray-800"}
        `}
      >
        <button onClick={contact.onOpen}>Contact Us</button>

        {!user ? (
          <>
            <button onClick={()=> signIn('google', {callbackUrl:"/dashboard"})}>Log In</button>
            <button
              onClick={()=> signIn('google', {callbackUrl:"/dashboard"})}
              className={`
                px-4 py-2 rounded-full text-sm font-semibold transition-all duration-1000
                ${
                  scrolled
                    ? "bg-gray-700 text-white hover:bg-gray-800"
                    : "bg-gray-200 text-gray-900 hover:bg-gray-200"
                }
              `}
            >
              Get Started
            </button>
          </>
        ) : (
          <Link
            href="/dashboard"
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-tr from-sky-800 to-sky-300 text-white text-sm font-semibold"
          >
            Dashboard
          </Link>
        )}
      </div>
    </div>
  </header>
  
      <button onClick={onOpen} className='lg:hidden flex justify-center items-center bg-cyan-800 rounded-lg p-2 z-50 fixed top-6 right-6 text-lg shadow-lg shadow-gray-500/50'>
        <RiMenuFill size={22} className='text-white'/>
      </button>

      <Drawer placement="right" onClose={onClose} isOpen={isOpen}>
        <DrawerOverlay />
        <DrawerContent className='lg:hidden'>
          <DrawerHeader borderBottomWidth={'1px'} className="bg-gray-800">
            <div className="flex justify-between items-center">
              <Link className='flex items-center justify-start gap-2 w-full' href={'/'}>
                <img className='h-8' src="/logo.svg" alt="" />
                <h1 className='text-gray-200 font-bold text-xl'>GTM Engine</h1>
              </Link>
              <DrawerCloseButton className="text-gray-400 border-2 border-gray-400" />
            </div>
          </DrawerHeader>

          <DrawerBody className='bg-gray-800'>
            <VStack spacing={'4'} alignItems="flex-start">
              <LinkButton active={params === '/contact-us' ? true :false} onClose={onClose} url="/contact-us" title="Contact Us" />
              {/* <LinkButton onClose={onClose} url="/dashboard/pricing" title="Pricing" /> */}
              {/* // FAQ LinkButton */}
              <a className='w-full text-white rounded-full p-2 ps-4 font-semibold' onClick={onClose} href="/#faq">FAQs</a>

              <HStack
                justifyContent={'space-evenly'}
                position="absolute"
                bottom={'5rem'}
                width="80%"
              >
                {user ? (
                  <>
                    <Link href={'/dashboard'} className='flex items-center justify-center gap-2 p-2 px-4 rounded-full bg-gradient-to-tr from-cyan-800 to-cyan-300 text-white text-sm font-semibold'>Dashboard <FaRegArrowAltCircleRight size={20}/></Link>
                  </>
                ) : (
                  <>
                    <button onClick={()=> signIn('google', {callbackUrl:"/dashboard"})}>
                      <Button colorScheme='gray'>Login</Button>
                    </button>

                    

                    <button onClick={contact.onOpen}>
                      <Button colorScheme={'yellow'}>Get Started</Button>
                    </button>
                  </>
                )}
              </HStack>
            </VStack>
          </DrawerBody>
        </DrawerContent>
      </Drawer>


      {/* <ContactUs isOpen={contact.isOpen} onClose={contact.onClose} /> */}
    
    </>
  )

}

const LinkButton = ({ url = '/', title = 'Home', onClose, active }) => (
  <Link onClick={onClose} href={url || '/'}>
    <div className={`w-full text-white rounded-full p-2 ps-4 font-semibold`}>{title}</div>
  </Link>
);

export default Header