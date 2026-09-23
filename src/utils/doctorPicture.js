/**
 * The doctor's picture is uploaded to and served by the user-auth service; the doctor-payment service
 * only snapshots which file belongs to the doctor, so patients can find it. These helpers convert
 * between the absolute URL user-auth returns and the path that gets stored.
 */
const PICTURE_PATH_PATTERN = /^\/uploads\/profile-pictures\/[A-Za-z0-9._-]{1,100}$/;

/** Path portion of a user-auth picture URL, or null when there is no usable picture. */
export const picturePathFromUrl = (value) => {
  const text = (value ?? '').toString().trim();
  if (!text) return null;

  let path = text;
  if (/^https?:\/\//i.test(text)) {
    try {
      path = new URL(text).pathname;
    } catch {
      return null;
    }
  }

  return PICTURE_PATH_PATTERN.test(path) ? path : null;
};

/** The picture path for an account payload from user-auth, tolerating its two casings. */
export const accountPicturePath = (account) => {
  const hasPicture = account?.hasProfilePicture ?? account?.HasProfilePicture;
  if (hasPicture === false) return null;
  return picturePathFromUrl(account?.profilePictureUrl ?? account?.ProfilePictureUrl);
};
