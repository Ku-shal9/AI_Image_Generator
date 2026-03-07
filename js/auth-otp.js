/**
 * auth-otp.js - OTP generate/verify, resetPasswordWithOTP, sendOTPEmail
 */

function generateOTP(username) {
  const user = findUserByUsername(username);
  if (!user || !user.email) return null;

  const otp = String(Math.floor(100000 + Math.random() * 900000));
  const expiry = Date.now() + OTP_EXPIRY_MS;

  localStorage.setItem(
    "pg_otp_" + user.id,
    JSON.stringify({ otp, expiry, userId: user.id }),
  );

  return otp;
}

function verifyOTP(username, enteredOtp) {
  const user = findUserByUsername(username);
  if (!user) return { valid: false, message: "User not found." };

  const stored = localStorage.getItem("pg_otp_" + user.id);
  if (!stored)
    return {
      valid: false,
      message: "No OTP requested. Please request a new one.",
    };

  const { otp, expiry } = JSON.parse(stored);

  if (Date.now() > expiry) {
    localStorage.removeItem("pg_otp_" + user.id);
    return {
      valid: false,
      message: "OTP has expired. Please request a new one.",
    };
  }

  if (otp !== enteredOtp.trim()) {
    return { valid: false, message: "Incorrect OTP. Please try again." };
  }

  localStorage.removeItem("pg_otp_" + user.id);
  return { valid: true, userId: user.id, message: "OTP verified." };
}

function resetPasswordWithOTP(userId, newPassword) {
  if (!newPassword || newPassword.length < 4) {
    return {
      success: false,
      message: "Password must be at least 4 characters.",
    };
  }
  updateUser(userId, { password: newPassword });
  return {
    success: true,
    message: "Password reset successfully. You can now sign in.",
  };
}

async function sendOTPEmail(toEmail, username, otpCode) {
  if (typeof emailjs === "undefined") {
    return {
      success: false,
      message: "Email service not loaded. Please refresh and try again.",
    };
  }

  try {
    await emailjs.send(
      EMAILJS_SERVICE_ID,
      EMAILJS_TEMPLATE_ID,
      {
        toEmail: toEmail,
        username: username,
        otp_code: otpCode,
      },
      {
        publicKey: EMAILJS_PUBLIC_KEY,
      },
    );
    return { success: true, message: "OTP sent to your email." };
  } catch (err) {
    console.error("[Photo Galli] EmailJS error:", err, err && err.text);
    return {
      success: false,
      message: "Failed to send email. Please try again.",
    };
  }
}
