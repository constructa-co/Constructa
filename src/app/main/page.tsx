"use client";

import { useEffect, useRef } from 'react';
import ScrollContainer from './components/ScrollContainer';
import ScrollSection from './components/ScrollSection';

const MainPage = () => {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleScroll = () => {
      const sections = container.querySelectorAll('section');
      const containerRect = container.getBoundingClientRect();
      
      sections.forEach((section) => {
        const sectionRect = section.getBoundingClientRect();
        const sectionTop = sectionRect.top - containerRect.top;
        const sectionBottom = sectionRect.bottom - containerRect.top;
        
        if (sectionTop <= 0 && sectionBottom > 0) {
          section.classList.add('active');
        } else {
          section.classList.remove('active');
        }
      });
    };

    container.addEventListener('scroll', handleScroll);
    return () => container.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <ScrollContainer ref={containerRef}>
      <ScrollSection id="hero">
        <h1 className="text-4xl md:text-6xl font-bold text-white">Welcome to Constructa</h1>
        <p className="text-xl text-gray-300 mt-4">Building the future of construction</p>
      </ScrollSection>
      
      <ScrollSection id="about">
        <h2 className="text-3xl md:text-5xl font-bold text-white">About Us</h2>
        <p className="text-xl text-gray-300 mt-4">Learn more about our mission and vision</p>
      </ScrollSection>
      
      <ScrollSection id="services">
        <h2 className="text-3xl md:text-5xl font-bold text-white">Our Services</h2>
        <p className="text-xl text-gray-300 mt-4">Discover what we can do for you</p>
      </ScrollSection>
      
      <ScrollSection id="contact">
        <h2 className="text-3xl md:text-5xl font-bold text-white">Contact Us</h2>
        <p className="text-xl text-gray-300 mt-4">Get in touch with our team</p>
      </ScrollSection>
    </ScrollContainer>
  );
};

export default MainPage;