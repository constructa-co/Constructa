// Feature scroll animation
document.addEventListener('DOMContentLoaded', () => {
  const featureImages = document.querySelectorAll('#feature-images img');
  const featureContents = document.querySelectorAll('.feature-content');
  
  if (featureImages.length === 0 || featureContents.length === 0) return;

  // Show first image initially
  featureImages[0].style.opacity = '1';
  
  // Create intersection observer for each feature content
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const imageId = entry.target.getAttribute('data-image');
        
        // Hide all images with a fade
        featureImages.forEach(img => {
          if (img.id === imageId) {
            img.style.opacity = '1';
            img.style.zIndex = '1';
          } else {
            img.style.opacity = '0';
            img.style.zIndex = '0';
          }
        });
        
        // Update active state for content
        featureContents.forEach(content => {
          if (content === entry.target) {
            content.classList.add('active');
          } else {
            content.classList.remove('active');
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