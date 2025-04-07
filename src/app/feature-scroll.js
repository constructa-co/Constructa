// Feature scroll animation
document.addEventListener('DOMContentLoaded', () => {
  const featureImages = document.querySelectorAll('.feature-image');
  const featureContents = document.querySelectorAll('.feature-content');
  
  if (featureContents.length === 0) return;

  // Function to update active section
  const updateActiveSection = (index) => {
    // Hide all sections first
    featureImages.forEach(image => {
      image.style.opacity = '0';
      image.style.visibility = 'hidden';
      image.style.zIndex = '0';
    });
    
    featureContents.forEach(content => {
      content.style.opacity = '0';
      content.style.visibility = 'hidden';
      content.style.zIndex = '0';
    });
    
    // Show active section
    if (featureImages[index]) {
      featureImages[index].style.opacity = '1';
      featureImages[index].style.visibility = 'visible';
      featureImages[index].style.zIndex = '1';
    }
    
    if (featureContents[index]) {
      featureContents[index].style.opacity = '1';
      featureContents[index].style.visibility = 'visible';
      featureContents[index].style.zIndex = '1';
    }
  };

  // Set initial styles
  featureImages.forEach(image => {
    image.style.transition = 'opacity 0.15s ease-out, visibility 0.15s ease-out';
  });

  featureContents.forEach(content => {
    content.style.transition = 'opacity 0.15s ease-out, visibility 0.15s ease-out';
  });

  // Set initial state
  updateActiveSection(0);

  // Handle scroll
  let lastScrollTime = Date.now();
  let ticking = false;

  window.addEventListener('scroll', () => {
    const now = Date.now();
    
    if (!ticking) {
      window.requestAnimationFrame(() => {
        const scrollPosition = window.scrollY;
        const containerHeight = document.querySelector('.h-[300vh]').offsetHeight;
        const sectionHeight = containerHeight / 4;
        const activeIndex = Math.min(3, Math.max(0, Math.floor((scrollPosition / sectionHeight) * 4)));
        
        updateActiveSection(activeIndex);
        ticking = false;
      });
      
      ticking = true;
    }
  });
}); 