export { default } from "next-auth/middleware";

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/campaigns/:path*",
    "/integrations/:path*",
    "/context/:path*",
    "/teams/:path*",
    "/profile/:path*",
    "/admin/:path*",
    "/invite/:path*",
  ],
};
