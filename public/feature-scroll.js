// Feature scroll animation
document.addEventListener('DOMContentLoaded', () => {
  const featureImage = document.getElementById('feature-image');
  const featureContents = document.querySelectorAll('.feature-content');
  
  if (!featureImage || featureContents.length === 0) return;
  
  // Set initial image
  featureImage.src = featureContents[0].getAttribute('data-image');
  
  // Create intersection observer for each feature content
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        // When a feature content is in view, update the image
        const imagePath = entry.target.getAttribute('data-image');
        featureImage.src = imagePath;
      }
    });
  }, {
    threshold: 0.5, // Trigger when 50% of the element is visible
    rootMargin: '-10% 0px -10% 0px' // Adjust the trigger area
  });
  
  // Observe each feature content
  featureContents.forEach(content => {
    observer.observe(content);
  });
}); 