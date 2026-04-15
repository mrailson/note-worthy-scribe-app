import PptxGenJS from "pptxgenjs";
import { PresentationTemplate, getTemplateById } from './presentationTemplates';
import { SlideContent, PresentationContent, SlideAnimation } from '@/types/presentation';

export interface EnhancedGenerationOptions {
  template: PresentationTemplate;
  content: PresentationContent;
  metadata: {
    topic: string;
    presentationType: string;
    slideCount: number;
    complexityLevel: string;
    generatedAt: string;
  };
  titleFontSize?: number;
  contentFontSize?: number;
  globalAnimation?: SlideAnimation;
  slideImages?: { [slideIndex: number]: string };
  slideAudio?: { [slideIndex: number]: string };
}

class LayoutEngine {
  static calculateOptimalLayout(content: string[], slideWidth: number = 13.33, slideHeight: number = 7.5) {
    const availableHeight = slideHeight - 2.8; // Reserve space for title and footer
    const lineHeight = 0.35; // Reduced line height for better spacing
    const maxLinesPerSlide = Math.floor(availableHeight / lineHeight);
    
    // If content fits in one slide, return single layout
    if (content.length <= maxLinesPerSlide) {
      return {
        slides: [{ content, startY: 1.8 }],
        layout: 'single'
      };
    }
    
    // Split content across multiple slides if needed
    const slides = [];
    let currentIndex = 0;
    
    while (currentIndex < content.length) {
      const slideContent = content.slice(currentIndex, currentIndex + maxLinesPerSlide);
      slides.push({ content: slideContent, startY: 1.8 });
      currentIndex += maxLinesPerSlide;
    }
    
    return {
      slides,
      layout: 'multi'
    };
  }
  
  static optimizeTextForSlide(text: string, maxLength: number = 85): string {
    if (text.length <= maxLength) return text;
    
    // Find the best break point near the max length
    const words = text.split(' ');
    let currentLength = 0;
    let wordIndex = 0;
    
    for (const word of words) {
      if (currentLength + word.length + 1 > maxLength) break;
      currentLength += word.length + 1;
      wordIndex++;
    }
    
    const truncated = words.slice(0, wordIndex).join(' ');
    return truncated + (wordIndex < words.length ? '...' : '');
  }
  
  static formatTextForPowerPoint(text: string): string {
    // Clean up text formatting for PowerPoint
    return text
      .replace(/[\u2018\u2019]/g, "'") // Replace smart quotes
      .replace(/[\u201C\u201D]/g, '"') // Replace smart double quotes
      .replace(/\u2013/g, '-') // Replace en dash
      .replace(/\u2014/g, '--') // Replace em dash
      .replace(/\s+/g, ' ') // Replace multiple spaces with single space
      .trim();
  }
}

class TemplateRenderer {
  private template: PresentationTemplate;
  private pptx: PptxGenJS;
  
  constructor(template: PresentationTemplate) {
    this.template = template;
    this.pptx = new PptxGenJS();
    this.setupPresentation();
  }
  
  private setupPresentation() {
    // Set presentation properties
    this.pptx.author = "Notewell AI";
    this.pptx.company = "NHS Healthcare";
    // Set widescreen 16:9 aspect ratio for modern displays
    this.pptx.defineLayout({ name: 'WIDESCREEN_LAYOUT', width: 13.33, height: 7.5 });
    this.pptx.layout = 'WIDESCREEN_LAYOUT';
  }
  
  private addTemplateBackground(slide: any) {
    // Apply background image if available, otherwise use background color
    if (this.template.backgroundImage) {
      // Check if it's a base64 image or a URL path
      if (this.template.backgroundImage.startsWith('data:image/')) {
        // Base64 image - extract the data part
        slide.background = { 
          data: this.template.backgroundImage.split(',')[1],
          sizing: { type: 'cover', x: 0, y: 0, w: 13.33, h: 7.5 }
        };
      } else {
        // URL path - use as image path
        slide.background = { 
          path: this.template.backgroundImage,
          sizing: { type: 'cover', x: 0, y: 0, w: 13.33, h: 7.5 }
        };
      }
    } else {
      slide.background = { fill: this.template.backgroundColor };
    }
    
    // Add template-specific design elements based on style
    switch (this.template.style) {
      case 'dark':
        // Add gradient overlay for dark theme
        slide.addShape(this.pptx.ShapeType.rect, {
          x: 0,
          y: 0,
          w: 13.33,
          h: 7.5,
          fill: { 
            type: 'gradient',
            color1: this.template.backgroundColor,
            color2: this.template.secondaryColor,
            dir: 'toBottom'
          },
          line: { width: 0 }
        });
        break;
        
      case 'modern':
        // Add modern header bar
        slide.addShape(this.pptx.ShapeType.rect, {
          x: 0,
          y: 0,
          w: 13.33,
          h: 0.5,
          fill: { color: this.template.primaryColor },
          line: { width: 0 }
        });
        // Add subtle corner accent
        slide.addShape(this.pptx.ShapeType.triangle, {
          x: 12.33,
          y: 0.5,
          w: 1,
          h: 1,
          fill: { color: this.template.accentColor, transparency: 70 },
          line: { width: 0 }
        });
        break;
        
      case 'bright':
        // Add colorful header gradient
        slide.addShape(this.pptx.ShapeType.rect, {
          x: 0,
          y: 0,
          w: 13.33,
          h: 1.2,
          fill: { 
            type: 'gradient',
            color1: this.template.primaryColor,
            color2: this.template.accentColor,
            dir: 'toRight'
          },
          line: { width: 0 }
        });
        // Add decorative circles
        slide.addShape(this.pptx.ShapeType.ellipse, {
          x: 0.5,
          y: 6.0,
          w: 0.8,
          h: 0.8,
          fill: { color: this.template.accentColor, transparency: 80 },
          line: { width: 0 }
        });
        break;
        
      case 'professional':
        // Add NHS-style header
        slide.addShape(this.pptx.ShapeType.rect, {
          x: 0,
          y: 0,
          w: 13.33,
          h: 0.8,
          fill: { color: this.template.primaryColor },
          line: { width: 0 }
        });
        // Add logo placeholder
        slide.addShape(this.pptx.ShapeType.rect, {
          x: 0.3,
          y: 0.1,
          w: 1.2,
          h: 0.6,
          fill: { color: this.template.backgroundColor },
          line: { width: 2, color: this.template.secondaryColor }
        });
        break;
        
      case 'clean':
        // Add minimal side accent
        slide.addShape(this.pptx.ShapeType.rect, {
          x: 0,
          y: 0,
          w: 0.2,
          h: 7.5,
          fill: { color: this.template.primaryColor },
          line: { width: 0 }
        });
        break;
        
      default:
        // Default minimal styling
        break;
    }
  }
  
  private addTemplateFooter(slide: any, slideNumber?: number, totalSlides?: number) {
    const timestamp = `AI Generated – ${new Date().toLocaleDateString()}`;
    
    // Footer background bar for dark theme (adjusted for widescreen)
    if (this.template.style === 'dark') {
      slide.addShape(this.pptx.ShapeType.rect, {
        x: 0,
        y: 6.8,
        w: 13.33,
        h: 0.7,
        fill: { color: this.template.secondaryColor, transparency: 70 },
        line: { width: 0 }
      });
    }
    
    // Footer text (adjusted for widescreen)
    slide.addText(timestamp, {
      x: 0.5,
      y: 6.9,
      w: 8,
      h: 0.4,
      fontSize: 12,
      color: this.template.footerColor,
      fontFace: this.template.fonts.body,
      align: 'left'
    });
    
    // Slide number (adjusted for widescreen)
    if (slideNumber && totalSlides) {
      slide.addText(`${slideNumber} / ${totalSlides}`, {
        x: 11.83,
        y: 6.9,
        w: 1.5,
        h: 0.4,
        fontSize: 12,
        color: this.template.footerColor,
        fontFace: this.template.fonts.body,
        align: 'right'
      });
    }
  }
  
  createTitleSlide(title: string, subtitle?: string, titleFontSize: number = 38) {
    const slide = this.pptx.addSlide();
    this.addTemplateBackground(slide);
    
    // Main title with template-specific styling and custom font size (adjusted for widescreen)
    const titleConfig: any = {
      x: 1.5,
      y: 2.5,
      w: 10.33,
      h: 1.5,
      fontSize: this.template.style === 'bright' ? titleFontSize + 4 : titleFontSize,
      bold: true,
      color: this.template.headingColor,
      fontFace: this.template.fonts.heading,
      align: 'center'
    };
    
    // Add shadow for dark theme
    if (this.template.style === 'dark') {
      titleConfig.glow = { size: 8, color: this.template.primaryColor, opacity: 0.5 };
    }
    
    slide.addText(title, titleConfig);
    
    // Subtitle (adjusted for widescreen)
    if (subtitle) {
      slide.addText(subtitle, {
        x: 1.5,
        y: 4.2,
        w: 10.33,
        h: 0.8,
        fontSize: this.template.style === 'bright' ? 24 : 22,
        color: this.template.textColor,
        fontFace: this.template.fonts.body,
        align: 'center'
      });
    }
    
    // Template-specific decorative elements
    if (this.template.style === 'bright') {
      // Add colorful accent shapes
      slide.addShape(this.pptx.ShapeType.ellipse, {
        x: 0.5,
        y: 1.5,
        w: 0.8,
        h: 0.8,
        fill: { color: this.template.accentColor, transparency: 60 },
        line: { width: 0 }
      });
      
      slide.addShape(this.pptx.ShapeType.ellipse, {
        x: 8.7,
        y: 5.5,
        w: 0.6,
        h: 0.6,
        fill: { color: this.template.primaryColor, transparency: 70 },
        line: { width: 0 }
      });
    }
    
    this.addTemplateFooter(slide);
  }
  
  private addMetricCard(slide: any, metric: any, x: number, y: number, w: number, h: number) {
    // Card background
    slide.addShape(this.pptx.ShapeType.rect, {
      x, y, w, h,
      fill: { color: this.template.secondaryColor, transparency: 20 },
      line: { width: 1, color: this.template.primaryColor }
    });
    
    // Large metric value
    slide.addText(metric.value, {
      x: x + 0.1,
      y: y + 0.2,
      w: w - 0.2,
      h: h * 0.5,
      fontSize: 36,
      bold: true,
      color: this.template.primaryColor,
      fontFace: this.template.fonts.heading,
      align: 'center'
    });
    
    // Metric label
    slide.addText(metric.label, {
      x: x + 0.1,
      y: y + h * 0.6,
      w: w - 0.2,
      h: h * 0.25,
      fontSize: 14,
      color: this.template.textColor,
      fontFace: this.template.fonts.body,
      align: 'center'
    });
    
    // Trend indicator if available
    if (metric.trend && metric.changePercent) {
      const trendColor = metric.trend === 'up' ? '00AA00' : metric.trend === 'down' ? 'DD0000' : '888888';
      const trendSymbol = metric.trend === 'up' ? '↑' : metric.trend === 'down' ? '↓' : '→';
      slide.addText(`${trendSymbol} ${metric.changePercent}`, {
        x: x + 0.1,
        y: y + h * 0.85,
        w: w - 0.2,
        h: 0.2,
        fontSize: 11,
        color: trendColor,
        fontFace: this.template.fonts.body,
        align: 'center',
        bold: true
      });
    }
  }

  private addActionCard(slide: any, action: any, x: number, y: number, w: number, h: number) {
    // Priority badge
    const priorityColors = ['DD3333', 'FF8800', '0088DD', '888888'];
    const priorityColor = priorityColors[Math.min(action.priority - 1, 3)];
    
    slide.addShape(this.pptx.ShapeType.ellipse, {
      x: x + 0.1,
      y: y + 0.1,
      w: 0.4,
      h: 0.4,
      fill: { color: priorityColor },
      line: { width: 0 }
    });
    
    slide.addText(action.priority.toString(), {
      x: x + 0.1,
      y: y + 0.1,
      w: 0.4,
      h: 0.4,
      fontSize: 18,
      bold: true,
      color: 'FFFFFF',
      fontFace: this.template.fonts.heading,
      align: 'center',
      valign: 'middle'
    });
    
    // Action background card
    slide.addShape(this.pptx.ShapeType.rect, {
      x: x + 0.6,
      y,
      w: w - 0.7,
      h,
      fill: { color: this.template.backgroundColor, transparency: 10 },
      line: { width: 1, color: priorityColor }
    });
    
    // Action text
    slide.addText(action.action, {
      x: x + 0.7,
      y: y + 0.1,
      w: w - 0.9,
      h: h * 0.5,
      fontSize: 14,
      bold: true,
      color: this.template.textColor,
      fontFace: this.template.fonts.body,
      valign: 'top'
    });
    
    // Owner and deadline
    if (action.owner || action.deadline) {
      const detailText = [action.owner, action.deadline].filter(Boolean).join(' • ');
      slide.addText(detailText, {
        x: x + 0.7,
        y: y + h * 0.6,
        w: w - 0.9,
        h: h * 0.3,
        fontSize: 11,
        color: this.template.accentColor,
        fontFace: this.template.fonts.body,
        italic: true
      });
    }
  }

  private addTimelineStep(slide: any, step: any, x: number, y: number, w: number, isLast: boolean) {
    const nodeSize = 0.35;
    const nodeY = y;
    
    // Timeline node
    slide.addShape(this.pptx.ShapeType.ellipse, {
      x: x,
      y: nodeY,
      w: nodeSize,
      h: nodeSize,
      fill: { color: this.template.primaryColor },
      line: { width: 2, color: this.template.accentColor }
    });
    
    // Connecting line to next node
    if (!isLast) {
      slide.addShape(this.pptx.ShapeType.line, {
        x: x + nodeSize,
        y: nodeY + nodeSize / 2,
        w: w - nodeSize - 0.1,
        h: 0,
        line: { width: 3, color: this.template.primaryColor }
      });
    }
    
    // Phase label above
    slide.addText(step.phase, {
      x: x - 0.3,
      y: nodeY - 0.5,
      w: nodeSize + 0.6,
      h: 0.3,
      fontSize: 13,
      bold: true,
      color: this.template.headingColor,
      fontFace: this.template.fonts.heading,
      align: 'center'
    });
    
    // Duration below node
    slide.addText(step.duration, {
      x: x - 0.3,
      y: nodeY + nodeSize + 0.05,
      w: nodeSize + 0.6,
      h: 0.25,
      fontSize: 11,
      color: this.template.accentColor,
      fontFace: this.template.fonts.body,
      align: 'center',
      italic: true
    });
    
    // Description below
    slide.addText(step.description, {
      x: x - 0.5,
      y: nodeY + nodeSize + 0.35,
      w: Math.min(w + 0.4, 2.5),
      h: 0.6,
      fontSize: 10,
      color: this.template.textColor,
      fontFace: this.template.fonts.body,
      align: 'center',
      valign: 'top',
      wrap: true
    });
  }

  createContentSlide(slideData: SlideContent, slideNumber: number, totalSlides: number, titleFontSize: number = 28, contentFontSize: number = 16, imageData?: string, audioData?: string) {
    const slide = this.pptx.addSlide();
    this.addTemplateBackground(slide);
    
    // Determine if we have an image to display
    const hasImage = imageData && imageData.length > 0;
    const contentWidth = hasImage ? 6.5 : 11.33;
    
    // Title with template styling and custom font size (adjusted for widescreen)
    const titleConfig: any = {
      x: 1,
      y: 0.8,
      w: contentWidth + 0.33,
      h: 0.8,
      fontSize: this.template.style === 'bright' ? titleFontSize + 4 : titleFontSize,
      bold: true,
      color: this.template.headingColor,
      fontFace: this.template.fonts.heading
    };
    
    slide.addText(slideData.title, titleConfig);
    
    // Add image if available (right side)
    if (hasImage) {
      try {
        slide.addImage({
          data: imageData,
          x: 8.5,
          y: 1.8,
          w: 4.0,
          h: 4.0,
          sizing: { type: 'contain', w: 4.0, h: 4.0 }
        });
      } catch (error) {
        console.error('Error adding image to slide:', error);
      }
    }
    
    // Render content based on slide type
    const slideType = slideData.type.toLowerCase();
    
    if (slideType === 'key-metrics' && slideData.metrics && slideData.metrics.length > 0) {
      // Dashboard layout for metrics
      const metricsPerRow = 2;
      const cardWidth = 3.0;
      const cardHeight = 1.8;
      const cardSpacingX = 3.5;
      const cardSpacingY = 2.2;
      const startX = 1.5;
      const startY = 2.0;
      
      slideData.metrics.slice(0, 4).forEach((metric, index) => {
        const row = Math.floor(index / metricsPerRow);
        const col = index % metricsPerRow;
        this.addMetricCard(
          slide,
          metric,
          startX + (col * cardSpacingX),
          startY + (row * cardSpacingY),
          cardWidth,
          cardHeight
        );
      });
      
    } else if (slideType === 'recommendations' && slideData.actions && slideData.actions.length > 0) {
      // Action cards layout
      const cardHeight = 0.9;
      const cardSpacing = 1.1;
      const startY = 2.0;
      
      slideData.actions.slice(0, 4).forEach((action, index) => {
        this.addActionCard(
          slide,
          action,
          1.0,
          startY + (index * cardSpacing),
          hasImage ? 6.5 : 11.0,
          cardHeight
        );
      });
      
    } else if (slideType === 'next-steps' && slideData.timeline && slideData.timeline.length > 0) {
      // Timeline layout
      const steps = slideData.timeline.slice(0, 4);
      const stepWidth = (hasImage ? 6.5 : 10.5) / steps.length;
      const startX = 1.5;
      const timelineY = 2.5;
      
      steps.forEach((step, index) => {
        this.addTimelineStep(
          slide,
          step,
          startX + (index * stepWidth),
          timelineY,
          stepWidth,
          index === steps.length - 1
        );
      });
      
    } else if (slideType === 'executive-summary') {
      // Hero card for executive summary
      if (slideData.content && slideData.content.length > 0) {
        // Main takeaway card
        slide.addShape(this.pptx.ShapeType.rect, {
          x: 1.5,
          y: 2.0,
          w: hasImage ? 5.5 : 10.0,
          h: 2.0,
          fill: { color: this.template.primaryColor, transparency: 10 },
          line: { width: 0 }
        });
        
        slide.addText(slideData.content[0], {
          x: 1.8,
          y: 2.3,
          w: hasImage ? 5.0 : 9.5,
          h: 1.5,
          fontSize: 18,
          bold: true,
          color: 'FFFFFF', // Always white for contrast on dark primary background
          fontFace: this.template.fonts.heading,
          valign: 'middle',
          wrap: true
        });
        
        // Additional takeaway boxes
        const remainingItems = slideData.content.slice(1, 4);
        const boxWidth = (hasImage ? 5.5 : 10.0) / remainingItems.length - 0.2;
        
        remainingItems.forEach((item, index) => {
          const boxX = 1.5 + (index * (boxWidth + 0.2));
          
          slide.addShape(this.pptx.ShapeType.rect, {
            x: boxX,
            y: 4.5,
            w: boxWidth,
            h: 1.5,
            fill: { color: this.template.secondaryColor, transparency: 30 },
            line: { width: 1, color: this.template.primaryColor }
          });
          
          slide.addText(item, {
            x: boxX + 0.1,
            y: 4.7,
            w: boxWidth - 0.2,
            h: 1.1,
            fontSize: 12,
            color: this.template.style === 'dark' ? 'FFFFFF' : this.template.textColor,
            fontFace: this.template.fonts.body,
            valign: 'top',
            wrap: true
          });
        });
      }
      
    } else {
      // Standard bullet point layout for other slide types
      if (slideData.content && slideData.content.length > 0) {
        const layout = LayoutEngine.calculateOptimalLayout(slideData.content);
        const contentToShow = layout.slides[0].content;
        const bulletCount = contentToShow.length;

        // Dynamic font size: fewer bullets = bigger text, more bullets = smaller text
        const dynamicFontSize = bulletCount <= 2 ? Math.min(contentFontSize + 4, 22)
          : bulletCount === 3 ? Math.min(contentFontSize + 2, 20)
          : bulletCount >= 5 ? Math.max(contentFontSize - 2, 13)
          : contentFontSize;

        // Dynamic spacing: fewer bullets get more breathing room
        const bulletSpacing = bulletCount <= 2 ? 0.85
          : bulletCount === 3 ? 0.72
          : bulletCount === 4 ? 0.62
          : 0.52;

        // Add a coloured rule under the slide title for visual separation
        slide.addShape(this.pptx.ShapeType.rect, {
          x: 1,
          y: 1.72,
          w: contentWidth,
          h: 0.04,
          fill: { color: this.template.primaryColor, transparency: 40 },
          line: { width: 0 }
        });

        // Content starts lower to allow breathing room after separator
        const contentStartY = 1.9;

        contentToShow.forEach((point, index) => {
          const cleanText = LayoutEngine.formatTextForPowerPoint(point);
          // Increase truncation limit significantly — NHS content needs full sentences
          const optimizedText = LayoutEngine.optimizeTextForSlide(cleanText, hasImage ? 90 : 130);
          const isLeadStatement = index === 0 && bulletCount >= 2;

          const textConfig: any = {
            x: 1,
            y: contentStartY + (index * bulletSpacing),
            w: contentWidth,
            h: bulletSpacing - 0.05,
            fontSize: isLeadStatement ? dynamicFontSize + 1 : dynamicFontSize,
            bold: isLeadStatement,
            fontFace: this.template.fonts.body,
            bullet: { type: 'bullet' },
            lineSpacing: dynamicFontSize <= 14 ? 16 : 20,
            wrap: true,
            breakLine: true,
            color: isLeadStatement
              ? this.template.headingColor
              : this.template.textColor
          };

          if (this.template.style === 'bright' && index % 2 === 1) {
            textConfig.color = this.template.accentColor;
          }

          slide.addText(optimizedText, textConfig);
        });

        if (layout.slides.length > 1) {
          slide.addText('(Content continues on next slide)', {
            x: 1,
            y: 6.5,
            w: contentWidth,
            h: 0.3,
            fontSize: 11,
            fontFace: this.template.fonts.body,
            color: this.template.footerColor,
            italic: true
          });
        }
      }
    }
    
    // Add slide type indicator for modern and clean themes (adjusted for widescreen)
    if (this.template.style === 'modern' || this.template.style === 'clean') {
      slide.addText(slideData.type.toUpperCase(), {
        x: 11.33,
        y: 0.3,
        w: 1.5,
        h: 0.3,
        fontSize: 10,
        fontFace: this.template.fonts.body,
        color: this.template.accentColor,
        align: 'right',
        bold: true
      });
    }
    
    this.addTemplateFooter(slide, slideNumber, totalSlides);
    
    // Add speaker notes if available
    if (slideData.notes) {
      slide.addNotes(slideData.notes);
    }
    
    // Add audio narration if available
    if (audioData) {
      try {
        slide.addMedia({
          type: 'audio',
          data: `data:audio/mpeg;base64,${audioData}`,
          x: 0.1,
          y: 0.1,
          w: 0.5,
          h: 0.5
        });
      } catch (error) {
        console.error('Error adding audio to slide:', error);
      }
    }
  }
  
  async generateFile(fileName: string): Promise<void> {
    await this.pptx.writeFile({ fileName });
  }
  
  getPptx(): PptxGenJS {
    return this.pptx;
  }
}

export const generateEnhancedPowerPoint = async (options: EnhancedGenerationOptions): Promise<void> => {
  const { template, content, metadata, titleFontSize = 32, contentFontSize = 16, globalAnimation, slideImages = {}, slideAudio = {} } = options;
  
  try {
    const renderer = new TemplateRenderer(template);
    
    // Apply global font sizes and animation settings
    if (titleFontSize || contentFontSize || globalAnimation) {
      // These will be applied in the createContentSlide method
    }
    
    // Create title slide (no global animation applied)
    renderer.createTitleSlide(
      content.title,
      `AI Generated ${metadata.presentationType} • ${metadata.complexityLevel} level`,
      titleFontSize
    );
    
    // Create content slides with global animation, images, and audio if specified
    content.slides.forEach((slideData, index) => {
      const slideWithGlobalAnimation = globalAnimation 
        ? { ...slideData, animation: slideData.animation || globalAnimation }
        : slideData;
      
      const slideImageData = slideImages[index];
      const slideAudioData = slideAudio[index];
      
      renderer.createContentSlide(
        slideWithGlobalAnimation, 
        index + 2, 
        content.slides.length + 1,
        titleFontSize,
        contentFontSize,
        slideImageData,
        slideAudioData
      );
    });
    
    // Generate file
    const fileName = `${content.title.replace(/[^a-zA-Z0-9]/g, '_')}_${template.id}_${new Date().toISOString().split('T')[0]}.pptx`;
    await renderer.generateFile(fileName);
    
  } catch (error) {
    console.error('Error generating enhanced PowerPoint:', error);
    throw new Error('Failed to generate enhanced PowerPoint presentation');
  }
};

export { LayoutEngine, TemplateRenderer };