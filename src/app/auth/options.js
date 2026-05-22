import GoogleProvider from "next-auth/providers/google";
// import { User } from "@/models/User";
// import { connectDB } from "@/libs/db";

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

        // await connectDB();

        // const existingUser = await User.findOne({
        //   email: user.email
        // });

        // if (!existingUser) {
        //   await User.create({
        //     name: user.name,
        //     email: user.email,
        //     image: user.image
        //   });
        // }

        // return true;

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