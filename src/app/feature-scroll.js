// Feature scroll animation
document.addEventListener('DOMContentLoaded', () => {
  const featureImage = document.getElementById('feature-image');
  const featureContents = document.querySelectorAll('.feature-content');
  
  if (!featureImage || featureContents.length === 0) return;

  // Create intersection observer for each feature content
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const imageSrc = entry.target.getAttribute('data-image');
        
        // Update image source with fade effect
        featureImage.style.opacity = '0';
        setTimeout(() => {
          // Update the src attribute of the Image component
          const imgElement = featureImage.querySelector('img');
          if (imgElement) {
            imgElement.src = imageSrc;
            featureImage.style.opacity = '1';
          }
        }, 300);
        
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