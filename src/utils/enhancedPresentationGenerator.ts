import PptxGenJS from "pptxgenjs";
import { PresentationTemplate, getTemplateById } from './presentationTemplates';
import { SlideContent, PresentationContent } from '@/types/presentation';

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
    // Always apply background color from template
    slide.background = { fill: this.template.backgroundColor };
    
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
  
  createTitleSlide(title: string, subtitle?: string) {
    const slide = this.pptx.addSlide();
    this.addTemplateBackground(slide);
    
    // Main title with template-specific styling (adjusted for widescreen)
    const titleConfig: any = {
      x: 1.5,
      y: 2.5,
      w: 10.33,
      h: 1.5,
      fontSize: this.template.style === 'bright' ? 42 : 38,
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
        fontSize: this.template.style === 'bright' ? 26 : 24,
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
  
  createContentSlide(slideData: SlideContent, slideNumber: number, totalSlides: number) {
    const slide = this.pptx.addSlide();
    this.addTemplateBackground(slide);
    
    // Title with template styling (adjusted for widescreen)
    const titleConfig: any = {
      x: 1,
      y: 0.8,
      w: 11.33,
      h: 0.8,
      fontSize: this.template.style === 'bright' ? 32 : 28,
      bold: true,
      color: this.template.headingColor,
      fontFace: this.template.fonts.heading
    };
    
    slide.addText(slideData.title, titleConfig);
    
    // Content with optimized layout
    if (slideData.content && slideData.content.length > 0) {
      const layout = LayoutEngine.calculateOptimalLayout(slideData.content);
      
      // If content needs multiple slides, only show first batch and add continuation note
      const contentToShow = layout.slides[0].content;
      
      contentToShow.forEach((point, index) => {
        const cleanText = LayoutEngine.formatTextForPowerPoint(point);
        const optimizedText = LayoutEngine.optimizeTextForSlide(cleanText, 85);
        
        const textConfig: any = {
          x: 1,
          y: 1.8 + (index * 0.35),
          w: 11.33,
          h: 0.3,
          fontSize: this.template.style === 'bright' ? 16 : 14,
          fontFace: this.template.fonts.body,
          bullet: { type: 'bullet' },
          lineSpacing: 20,
          wrap: true,
          breakLine: true,
          color: this.template.textColor
        };
        
        // Alternate bullet colors for bright theme
        if (this.template.style === 'bright' && index % 2 === 1) {
          textConfig.color = this.template.accentColor;
        }
        
        slide.addText(optimizedText, textConfig);
      });
      
      // Add continuation note if content was truncated (adjusted for widescreen)
      if (layout.slides.length > 1) {
        slide.addText('(Content continues...)', {
          x: 1.5,
          y: 6.0,
          w: 10.33,
          h: 0.3,
          fontSize: 14,
          fontFace: this.template.fonts.body,
          color: this.template.footerColor,
          italic: true
        });
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
  }
  
  async generateFile(fileName: string): Promise<void> {
    await this.pptx.writeFile({ fileName });
  }
  
  getPptx(): PptxGenJS {
    return this.pptx;
  }
}

export const generateEnhancedPowerPoint = async (options: EnhancedGenerationOptions): Promise<void> => {
  const { template, content, metadata } = options;
  
  try {
    const renderer = new TemplateRenderer(template);
    
    // Create title slide
    renderer.createTitleSlide(
      content.title,
      `AI Generated ${metadata.presentationType} • ${metadata.complexityLevel} level`
    );
    
    // Create content slides
    content.slides.forEach((slideData, index) => {
      renderer.createContentSlide(slideData, index + 2, content.slides.length + 1);
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