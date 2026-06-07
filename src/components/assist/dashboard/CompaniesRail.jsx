"use client";

import { useState } from "react";
import { Box, Text, VStack } from "@chakra-ui/react";
import CompanyCard from "./CompanyCard";
import CompanyDrawer from "../CompanyDrawer";

/**
 * Companies rail: a list of account cards that open the CompanyDrawer.
 * Owns the selected-account + drawer-open state (client side).
 */
export default function CompaniesRail({ accounts = [] }) {
  const [selected, setSelected] = useState(null);
  const [open, setOpen] = useState(false);

  const onOpen = (account) => {
    setSelected(account);
    setOpen(true);
  };

  return (
    <>
      {accounts.length === 0 ? (
        <Box borderWidth="1px" borderColor="gray.200" rounded="lg" bg="white" p={5}>
          <Text fontSize="sm" color="gray.400">
            No companies yet. Sync from HubSpot to hydrate your accounts.
          </Text>
        </Box>
      ) : (
        <VStack align="stretch" spacing={2.5}>
          {accounts.map((a) => (
            <CompanyCard key={a.id} account={a} onOpen={onOpen} />
          ))}
        </VStack>
      )}

      <CompanyDrawer
        accountId={selected?.id ?? null}
        isOpen={open}
        onClose={() => setOpen(false)}
      />
    </>
  );
}
