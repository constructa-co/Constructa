// Feature scroll animation
document.addEventListener('DOMContentLoaded', () => {
  const featureImages = document.querySelectorAll('.feature-image');
  const featureContents = document.querySelectorAll('.feature-content');
  
  if (featureContents.length === 0) return;

  // Create intersection observer
  const observer = new IntersectionObserver((entries) => {
    const scrollPosition = window.scrollY;
    const containerHeight = document.querySelector('.h-[300vh]').offsetHeight;
    const sectionHeight = containerHeight / 4; // 4 sections
    
    // Calculate which section should be active based on scroll position
    const activeIndex = Math.floor((scrollPosition / sectionHeight) * 4);
    
    // Update visibility of images and content
    featureImages.forEach((image, index) => {
      if (index === activeIndex) {
        image.style.opacity = '1';
        image.style.visibility = 'visible';
      } else {
        image.style.opacity = '0';
        image.style.visibility = 'hidden';
      }
    });
    
    featureContents.forEach((content, index) => {
      if (index === activeIndex) {
        content.style.opacity = '1';
        content.style.visibility = 'visible';
        content.style.transform = 'translateY(0)';
      } else {
        content.style.opacity = '0';
        content.style.visibility = 'hidden';
        content.style.transform = 'translateY(20px)';
      }
    });
  }, {
    threshold: [0, 0.25, 0.5, 0.75, 1],
  });

  // Set initial state
  featureImages.forEach((image, index) => {
    image.style.transition = 'opacity 0.2s ease-out, visibility 0.2s ease-out';
    if (index === 0) {
      image.style.opacity = '1';
      image.style.visibility = 'visible';
    } else {
      image.style.opacity = '0';
      image.style.visibility = 'hidden';
    }
  });

  featureContents.forEach((content, index) => {
    content.style.transition = 'opacity 0.2s ease-out, visibility 0.2s ease-out, transform 0.2s ease-out';
    if (index === 0) {
      content.style.opacity = '1';
      content.style.visibility = 'visible';
      content.style.transform = 'translateY(0)';
    } else {
      content.style.opacity = '0';
      content.style.visibility = 'hidden';
      content.style.transform = 'translateY(20px)';
    }
  });

  // Observe the container
  observer.observe(document.querySelector('.h-[300vh]'));
  
  // Add scroll event listener for smoother transitions
  window.addEventListener('scroll', () => {
    requestAnimationFrame(() => {
      const scrollPosition = window.scrollY;
      const containerHeight = document.querySelector('.h-[300vh]').offsetHeight;
      const sectionHeight = containerHeight / 4;
      const activeIndex = Math.floor((scrollPosition / sectionHeight) * 4);
      
      featureImages.forEach((image, index) => {
        if (index === activeIndex) {
          image.style.opacity = '1';
          image.style.visibility = 'visible';
        } else {
          image.style.opacity = '0';
          image.style.visibility = 'hidden';
        }
      });
      
      featureContents.forEach((content, index) => {
        if (index === activeIndex) {
          content.style.opacity = '1';
          content.style.visibility = 'visible';
          content.style.transform = 'translateY(0)';
        } else {
          content.style.opacity = '0';
          content.style.visibility = 'hidden';
          content.style.transform = 'translateY(20px)';
        }
      });
    });
  });
}); 