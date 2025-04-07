// Feature scroll animation
document.addEventListener('DOMContentLoaded', () => {
  const featureImage = document.getElementById('feature-image');
  const featureContents = document.querySelectorAll('.feature-content');
  const scrollContainer = document.querySelector('.snap-mandatory');
  
  if (!featureImage || !featureContents.length || !scrollContainer) return;

  // Show first content initially
  featureContents[0].querySelector('div').style.opacity = '1';

  let lastScrollTop = 0;
  let isScrolling = false;

  // Create intersection observer for each feature content
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting && !isScrolling) {
        const imageSrc = entry.target.getAttribute('data-image');
        const contentDiv = entry.target.querySelector('div');
        
        // Update image with fade effect
        featureImage.style.opacity = '0';
        setTimeout(() => {
          featureImage.src = imageSrc;
          featureImage.style.opacity = '1';
        }, 200);

        // Show current content
        contentDiv.style.opacity = '1';
        
        // Hide other content
        featureContents.forEach(content => {
          if (content !== entry.target) {
            const otherDiv = content.querySelector('div');
            otherDiv.style.opacity = '0';
          }
        });
      }
    });
  }, {
    threshold: 0.5,
    root: scrollContainer,
    rootMargin: '-10% 0px -10% 0px'
  });

  // Observe each feature content
  featureContents.forEach(content => {
    observer.observe(content);
  });

  // Handle scroll snapping
  scrollContainer.addEventListener('scroll', () => {
    if (!isScrolling) {
      isScrolling = true;
      window.requestAnimationFrame(() => {
        const currentScrollTop = scrollContainer.scrollTop;
        const direction = currentScrollTop > lastScrollTop ? 1 : -1;
        lastScrollTop = currentScrollTop;
        
        // Find the closest snap point
        const containerHeight = scrollContainer.clientHeight;
        const targetScroll = Math.round(currentScrollTop / containerHeight) * containerHeight;
        
        // Smooth scroll to the target
        scrollContainer.scrollTo({
          top: targetScroll,
          behavior: 'smooth'
        });
        
        setTimeout(() => {
          isScrolling = false;
        }, 100);
      });
    }
  }, { passive: true });
}); 