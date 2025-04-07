// Feature scroll animation
document.addEventListener('DOMContentLoaded', () => {
  const featureImage = document.getElementById('feature-image');
  const featureContents = document.querySelectorAll('.feature-content');
  
  if (!featureImage || featureContents.length === 0) return;

  // Show first content section initially
  featureContents[0].classList.add('active');
  featureContents[0].style.opacity = '1';

  // Create intersection observer for each feature content
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const imageSrc = entry.target.getAttribute('data-image');
        
        // Update image source with fade effect
        featureImage.style.opacity = '0';
        setTimeout(() => {
          // Update the src attribute of the Image component
          featureImage.src = imageSrc;
          featureImage.style.opacity = '1';
        }, 300);
        
        // Update active state for content
        featureContents.forEach(content => {
          if (content === entry.target) {
            content.classList.add('active');
            content.style.opacity = '1';
          } else {
            content.classList.remove('active');
            content.style.opacity = '0';
          }
        });
      }
    });
  }, {
    threshold: 0.5,
    rootMargin: '-35% 0px -35% 0px'
  });
  
  // Observe each feature content
  featureContents.forEach(content => {
    observer.observe(content);
  });
  
  // Add scroll-linked animation class to the sticky container
  const stickyContainer = document.querySelector('.lg\\:sticky');
  if (stickyContainer) {
    stickyContainer.style.transform = 'translateZ(0)';
    stickyContainer.style.willChange = 'transform';
  }
}); 