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
        
        // Use a different approach to update the image source
        setTimeout(() => {
          // Create a new image element to preload the image
          const newImage = new Image();
          newImage.onload = () => {
            // Once loaded, update the src attribute
            featureImage.src = imageSrc;
            featureImage.style.opacity = '1';
          };
          newImage.src = imageSrc;
        }, 200); // Reduced timing for snappier transitions
        
        // Update active state for content
        featureContents.forEach(content => {
          if (content === entry.target) {
            content.classList.add('active');
            content.style.opacity = '1';
          } else {
            content.classList.remove('active');
            content.style.opacity = '0.3'; // Dim non-active sections
          }
        });
      }
    });
  }, {
    threshold: 0.7, // Increased threshold for more precise snapping
    rootMargin: '-20% 0px -20% 0px' // Adjusted margins for better snap points
  });
  
  // Observe each feature content
  featureContents.forEach(content => {
    observer.observe(content);
  });

  // Set initial state
  featureContents[0].classList.add('active');
  featureContents[0].style.opacity = '1';
  featureContents.forEach((content, index) => {
    if (index !== 0) {
      content.style.opacity = '0.3';
    }
  });

  // Add scroll-linked animation class to the sticky container
  const stickyContainer = document.querySelector('.lg\\:sticky');
  if (stickyContainer) {
    stickyContainer.style.transform = 'translateZ(0)';
    stickyContainer.style.willChange = 'transform';
  }
}); 