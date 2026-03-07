/**
 * auth-profile.js - Profile picture, change password, updateNavbarProfile
 */

function getUserProfilePicture(userId) {
  const key = `pg_profile_pic_${userId}`;
  const perUser = localStorage.getItem(key);
  if (perUser) return perUser;

  const legacy = localStorage.getItem("pg_profile_pic");
  if (legacy) {
    localStorage.setItem(key, legacy);
    localStorage.removeItem("pg_profile_pic");
    return legacy;
  }

  return null;
}

function saveUserProfilePicture(userId, base64Image) {
  const key = `pg_profile_pic_${userId}`;
  localStorage.setItem(key, base64Image);
}

function removeUserProfilePicture(userId) {
  const key = `pg_profile_pic_${userId}`;
  localStorage.removeItem(key);
}

function changeUserPassword(oldPassword, newPassword) {
  const user = getCurrentUser();
  if (!user) {
    return { success: false, message: "Not logged in." };
  }

  if (user.password !== oldPassword) {
    return { success: false, message: "Current password is incorrect." };
  }

  if (!newPassword || newPassword.length < 4) {
    return {
      success: false,
      message: "New password must be at least 4 characters.",
    };
  }

  updateUser(user.id, { password: newPassword });

  return { success: true, message: "Password changed successfully." };
}

function updateNavbarProfile() {
  const session = getSession();
  const profileBtn = document.getElementById("profileBtn");
  const navProfileImg = document.getElementById("navProfileImg");
  const navProfileInitial = document.getElementById("navProfileInitial");

  if (!profileBtn || !session) return;

  const profilePic = getUserProfilePicture(session.id);
  const initial = session.username.charAt(0).toUpperCase();

  if (profilePic && navProfileImg && navProfileInitial) {
    navProfileImg.src = profilePic;
    navProfileImg.style.display = "block";
    navProfileInitial.style.display = "none";
  } else if (navProfileImg && navProfileInitial) {
    navProfileImg.style.display = "none";
    navProfileInitial.textContent = initial;
    navProfileInitial.style.display = "block";
  }
}
