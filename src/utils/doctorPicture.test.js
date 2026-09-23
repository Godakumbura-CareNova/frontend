import { describe, expect, it } from 'vitest';
import { accountPicturePath, picturePathFromUrl } from './doctorPicture';

describe('picturePathFromUrl', () => {
  it('keeps the path of a user-auth picture URL', () => {
    expect(picturePathFromUrl('https://auth.example.com/uploads/profile-pictures/nimal.jpg')).toBe('/uploads/profile-pictures/nimal.jpg');
    expect(picturePathFromUrl('/uploads/profile-pictures/nimal.jpg')).toBe('/uploads/profile-pictures/nimal.jpg');
  });

  it('rejects anything that is not a profile picture location', () => {
    expect(picturePathFromUrl('https://evil.example.com/tracker.gif')).toBeNull();
    expect(picturePathFromUrl('/uploads/medicines/x.png')).toBeNull();
    expect(picturePathFromUrl('')).toBeNull();
    expect(picturePathFromUrl(null)).toBeNull();
  });
});

describe('accountPicturePath', () => {
  it('reads the path from a user-auth account payload in either casing', () => {
    expect(accountPicturePath({ hasProfilePicture: true, profilePictureUrl: 'https://auth/uploads/profile-pictures/a.jpg' }))
      .toBe('/uploads/profile-pictures/a.jpg');
    expect(accountPicturePath({ HasProfilePicture: true, ProfilePictureUrl: '/uploads/profile-pictures/b.png' }))
      .toBe('/uploads/profile-pictures/b.png');
  });

  it('is null when the doctor has no picture', () => {
    expect(accountPicturePath({ hasProfilePicture: false, profilePictureUrl: '/uploads/profile-pictures/a.jpg' })).toBeNull();
    expect(accountPicturePath({})).toBeNull();
    expect(accountPicturePath(null)).toBeNull();
  });
});
