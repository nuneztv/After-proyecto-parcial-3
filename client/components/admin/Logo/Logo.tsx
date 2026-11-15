import Image from 'next/image';

// Intrinsic sizes of the files in public/images/brand (admin.css sets the displayed width)
const LOGOS = {
  lg: { src: '/images/brand/logo-after.png', width: 523, height: 255 },
  sm: { src: '/images/brand/logo-after-sm.png', width: 337, height: 163 },
};

export const Logo = ({ size = 'lg' }: { size?: 'lg' | 'sm' }) => {
  const { src, width, height } = LOGOS[size];

  return (
    <div className={size === 'sm' ? 'logo-mark sm' : 'logo-mark'}>
      <Image src={src} alt="After" width={width} height={height} priority />
      {size === 'lg' ? <p className="tagline">Discover after dark</p> : null}
    </div>
  );
};
