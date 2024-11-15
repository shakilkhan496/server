import dotenv from "dotenv";
dotenv.config();

export const cookieOptions = {
  secure: true,
  httpOnly: true,
  sameSite: "None",
};

export const clearAllCookies = (req, res) => {
  const cookies = Object.keys(req.cookies);

  cookies.forEach(cookie => {
    res.clearCookie(cookie, cookieOptions);
  });
};
