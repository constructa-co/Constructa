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
        
        // Hide all images
        featureImages.forEach(img => {
          img.style.opacity = '0';
        });
        
        // Show the corresponding image
        const targetImage = document.getElementById(imageId);
        if (targetImage) {
          setTimeout(() => {
            targetImage.style.opacity = '1';
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
    rootMargin: '-45% 0px -45% 0px' // Adjust the trigger area to be more centered
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