"use client"
import { useDisclosure } from "@chakra-ui/react"
import Link from "next/link"
import { DiGithub } from "react-icons/di"
import { FaFacebook, FaInstagram, FaLinkedin } from "react-icons/fa6"
import { RiInstagramFill } from "react-icons/ri"
import { TiSocialInstagramCircular, TiSocialYoutubeCircular } from "react-icons/ti"
// import ContactUs from "../dialogs/ContactUs"

const Footer = () => {

  const contact = useDisclosure();

  return (
    <div className="pt-20 sm:pt-10 bg-brand-dark">
      <div className="flex flex-col gap-12 lg:flex-row lg:justify-between lg:items-center max-w-[90vw] sm:max-w-6xl mx-auto">
        <div className="text-brand-steel max-w-md">
          <div className="flex gap-4 items-center">
            <a target="_blank" href="https://www.linkedin.com/company/nextscale-ai/"><FaLinkedin size={32} color="white" /></a>
            <a target="_blank"><FaFacebook size={30} color="white" /></a>
            <a target="_blank"><FaInstagram size={35} color="white" /></a>
          </div>
          <p className="mt-8">ClarityHQ powers human-led growth execution for ambitious D2C brands and agencies—unified brand context, one source of truth.</p>
          <p className="mt-16">
            For support, email us at <br />
            <a href="mailto:nextscale.ai@gmail.com" className="text-brand-terracotta">nextscale.ai@gmail.com</a>
          </p>
        </div>

        <div className="flex flex-col items-start gap-8 text-white">
          <a href={'/'}>Sign Up</a>
          <button onClick={contact.onOpen}>Pricing</button>
          <a href="/#faq">FAQs</a>
        </div>

        <div className="flex flex-col items-start gap-8 text-white">
          <Link href={'/privacy-policy'}>Privacy policy</Link>
          <Link href={'/terms-and-conditions'}>Terms and Conditions</Link>
          <button onClick={contact.onOpen}>Contact Us</button>
        </div>
      </div>

      <div className="max-w-6xl mx-auto flex justify-between mt-10 md:mt-0">
        <p className="text-[3.5rem] sm:text-[10rem] text-brand-secondary/30 font-serif font-semibold -pb-[2rem]">
          ClarityHQ
        </p>
      </div>

      {/* <ContactUs isOpen={contact.isOpen} onClose={contact.onClose} /> */}
    </div>
  )
}

export default Footer