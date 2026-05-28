import GoogleProvider from "next-auth/providers/google";
import { prisma } from "@/lib/prisma";

const authOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET
    }),
  ],

  callbacks: {
    async signIn({ user }) {
      try {
        await prisma.$transaction(async (tx) => {
          const existing = await tx.user.findUnique({
            where: { email: user.email },
            select: { id: true },
          });

          if (existing) {
            await tx.user.update({
              where: { id: existing.id },
              data: { name: user.name, image: user.image },
            });
            return;
          }

          const createdUser = await tx.user.create({
            data: {
              name: user.name,
              email: user.email,
              image: user.image,
              is_superadmin: false,
            },
            select: { id: true },
          });

          // Workspace is created in first-login onboarding step.
        });
        return true;
      } catch (error) {
        console.error("SignIn Error:", error);
        return false;
      }
    },
  },

  session: {
    strategy: "jwt",
  },

  secret: process.env.NEXTAUTH_SECRET,
};

export default authOptions;
