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
import { BRAND, ui } from '@/lib/brandUi';
import BrandLockup from '@/components/brand/BrandLockup';


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
            ? "bg-brand-bg/90 backdrop-blur-md shadow-sm border-b border-brand-secondary/20"
            : "bg-transparent"
        }
      `}
    >
      <div className="flex gap-16 items-center">
          <Link className='flex gap-2 items-center' href="/">
          <img src='/logo.svg' className='h-8' alt={BRAND.lockup}/>
          <h1 className="transition-colors duration-300">
            <BrandLockup inline />
          </h1>
        </Link>
      </div>

      <div
        className={`
          flex items-center gap-8 transition-colors duration-300
          text-brand-stone
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
                bg-brand-dark text-white hover:bg-brand-ink
              `}
            >
              Get Started
            </button>
          </>
        ) : (
          <Link
            href="/dashboard"
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-brand-dark text-white text-sm font-semibold hover:bg-brand-ink transition-colors"
          >
            Dashboard
          </Link>
        )}
      </div>
    </div>
  </header>
  
      <button type="button" onClick={onOpen} className={`${ui.mobileFab} fixed top-6 right-6 left-auto z-50`} aria-label="Open menu">
        <RiMenuFill size={22} className="text-brand-bg"/>
      </button>

      <Drawer placement="right" onClose={onClose} isOpen={isOpen}>
        <DrawerOverlay />
        <DrawerContent className='lg:hidden'>
          <DrawerHeader borderBottomWidth={'1px'} className={ui.mobileDrawerHeader}>
            <div className="flex justify-between items-center">
              <Link className='flex items-center justify-start gap-2 w-full' href={'/'} onClick={onClose}>
                <img className='h-8' src="/logo_white.svg" alt="" />
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
                    <Link href={'/dashboard'} className='flex items-center justify-center gap-2 p-2 px-4 rounded-lg bg-brand-bg text-brand-ink text-sm font-semibold hover:bg-white transition-colors'>Dashboard <FaRegArrowAltCircleRight size={20}/></Link>
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