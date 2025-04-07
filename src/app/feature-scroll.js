// Feature scroll animation
document.addEventListener('DOMContentLoaded', () => {
  const featureContents = document.querySelectorAll('.feature-content');
  
  if (featureContents.length === 0) return;

  // Create intersection observer for each feature content
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        // Make current section fully visible immediately
        entry.target.style.opacity = '1';
        entry.target.classList.add('active');
        
        // Show content immediately
        const content = entry.target.querySelector('.transform');
        if (content) {
          content.style.opacity = '1';
          content.style.transform = 'translateY(0)';
        }
      } else {
        // Hide non-visible sections immediately
        entry.target.style.opacity = '0';
        entry.target.classList.remove('active');
        
        // Hide content immediately
        const content = entry.target.querySelector('.transform');
        if (content) {
          content.style.opacity = '0';
          content.style.transform = 'translateY(20px)';
        }
      }
    });
  }, {
    threshold: 0.7, // Trigger when section is mostly visible
    rootMargin: '0px'
  });
  
  // Set initial state and observe each feature content
  featureContents.forEach((content, index) => {
    // Add minimal transition for smoother snap
    content.style.transition = 'opacity 0.15s ease-out';
    
    // Set initial state
    if (index === 0) {
      content.style.opacity = '1';
      content.classList.add('active');
      const contentDiv = content.querySelector('.transform');
      if (contentDiv) {
        contentDiv.style.opacity = '1';
        contentDiv.style.transform = 'translateY(0)';
      }
    } else {
      content.style.opacity = '0';
      const contentDiv = content.querySelector('.transform');
      if (contentDiv) {
        contentDiv.style.opacity = '0';
        contentDiv.style.transform = 'translateY(20px)';
      }
    }
    
    observer.observe(content);
  });
}); 