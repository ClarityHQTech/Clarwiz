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
        await prisma.user.upsert({
          where: { email: user.email },
          update: { name: user.name, image: user.image },
          create: {
            name: user.name,
            email: user.email,
            image: user.image,
          },
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
