export { default } from "next-auth/middleware";

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/campaigns/:path*",
    "/settings/:path*",
    "/profile/:path*",
    "/admin/:path*",
    "/invite/:path*",
  ],
};
