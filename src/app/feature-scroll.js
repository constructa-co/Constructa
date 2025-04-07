// Feature scroll animation
document.addEventListener('DOMContentLoaded', () => {
  const featureImage = document.getElementById('feature-image');
  const featureContents = document.querySelectorAll('.feature-content');
  
  if (!featureImage || featureContents.length === 0) return;

  // Set initial data attributes
  featureContents[0].setAttribute('data-image', '/images/Build your proposal White.png');
  featureContents[1].setAttribute('data-image', '/images/project Timecard.png');
  featureContents[2].setAttribute('data-image', '/images/One Tap Update White.png');
  featureContents[3].setAttribute('data-image', '/images/Client-Ready Quote White.png');

  // Create intersection observer for each feature content
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const imageSrc = entry.target.getAttribute('data-image');
        if (imageSrc) {
          featureImage.style.opacity = '0';
          setTimeout(() => {
            featureImage.src = imageSrc;
            featureImage.style.opacity = '1';
          }, 200);
        }
      }
    });
  }, {
    threshold: 0.5,
    rootMargin: '-10% 0px -10% 0px'
  });
  
  // Observe each feature content
  featureContents.forEach(content => {
    observer.observe(content);
  });
}); 