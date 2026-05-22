"use client";
import {
    Modal,
    ModalOverlay,
    ModalContent,
    ModalHeader,
    ModalBody,
    ModalCloseButton,
    Button,
    Input,
    Text,
    VStack,
    HStack,
    ModalFooter,
  } from "@chakra-ui/react";
  
  const Profile = ({ isOpen, onClose, user }) => {

  
    return (
      <Modal isOpen={isOpen} onClose={onClose} size="md" isCentered>
        <ModalOverlay backdropFilter="blur(6px)" />
        
        <ModalContent mx={3} borderRadius="xl">
  
          <ModalCloseButton />
  
          <ModalBody p={10}>
            <>
            <img
                src={user?.image || "https://t4.ftcdn.net/jpg/07/03/86/11/360_F_703861114_7YxIPnoH8NfmbyEffOziaXy0EO1NpRHD.jpg"}
                className="h-12 w-12 rounded-full object-cover"
                />

            <div className="flex-1 mt-6">
                <h3 className="font-semibold text">{user?.name}</h3>
                <p className="text-sm text-gray-600">{user?.email}</p>
                <p className="text-sm text-gray-400 mt-10">
                    Subscription · {user?.payment ? <span className="text-green-500 font-semibold">Active</span> : <span className="text-red-500 font-semibold">Inactive</span>}
                </p>
            </div>
            </>
          </ModalBody>
        </ModalContent>
      </Modal>
    );
  };
  
  export default Profile;
  