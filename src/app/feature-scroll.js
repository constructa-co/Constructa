// Feature scroll animation
document.addEventListener('DOMContentLoaded', () => {
  const featureImage = document.getElementById('feature-image');
  const featureContents = document.querySelectorAll('.feature-content');
  
  if (!featureImage || featureContents.length === 0) return;
  
  // Set initial image and make sure it's visible
  const firstImage = featureContents[0].getAttribute('data-image');
  if (firstImage) {
    featureImage.src = firstImage;
    featureImage.style.opacity = '1';
  }
  
  // Create intersection observer for each feature content
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        // When a feature content is in view, update the image
        const imagePath = entry.target.getAttribute('data-image');
        if (imagePath && featureImage.src !== imagePath) {
          // Add fade transition
          featureImage.style.opacity = '0';
          setTimeout(() => {
            featureImage.src = imagePath;
            featureImage.style.opacity = '1';
          }, 200);
        }
        
        // Update active state for content
        featureContents.forEach(content => {
          content.classList.remove('active');
        });
        entry.target.classList.add('active');
      }
    });
  }, {
    threshold: 0.5, // Trigger when 50% of the element is visible
    rootMargin: '-40% 0px -40% 0px' // Adjust the trigger area to be more centered
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