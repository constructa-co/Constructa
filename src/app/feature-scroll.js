// Feature scroll animation
document.addEventListener('DOMContentLoaded', () => {
  const featureImage = document.getElementById('feature-image');
  const featureContents = document.querySelectorAll('.feature-content');
  
  if (!featureImage || featureContents.length === 0) return;

  // Create intersection observer for each feature content
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      const contentDiv = entry.target.querySelector('div');
      
      if (entry.isIntersecting) {
        // Update image
        const imageSrc = entry.target.getAttribute('data-image');
        featureImage.src = imageSrc;
        
        // Show content with transform
        contentDiv.style.opacity = '1';
        contentDiv.style.transform = 'translateY(0)';
      } else {
        // Hide content
        contentDiv.style.opacity = '0';
        contentDiv.style.transform = 'translateY(20px)';
      }
    });
  }, {
    threshold: 0.5,
    rootMargin: '-20% 0px -20% 0px'
  });
  
  // Observe each feature content
  featureContents.forEach(content => {
    // Set initial state
    const contentDiv = content.querySelector('div');
    contentDiv.style.transform = 'translateY(20px)';
    
    observer.observe(content);
  });
}); 