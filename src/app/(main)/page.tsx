import React from 'react';
import Image from 'next/image';

export default function MainPage() {
  return (
    <div className="relative w-full h-screen">
      <Image
        src="/images/Cost Control 1.png"
        alt="Cost Control"
        fill
        className="object-contain"
        priority
      />
    </div>
  );
} 