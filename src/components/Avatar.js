// Renders a user's avatar image if they have one, falling back to their initial.
// `className` should be one of the existing sized avatar classes (avatar, contact-avatar, etc).
function Avatar({ name, avatarUrl, className }) {
  if (avatarUrl) {
    return <img src={avatarUrl} alt={name} className={`${className} avatar-image`} />;
  }
  return <div className={className}>{name?.charAt(0).toUpperCase() || '?'}</div>;
}

export default Avatar;
