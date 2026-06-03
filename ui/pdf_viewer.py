import os
from PySide6.QtWidgets import QDialog, QVBoxLayout, QHBoxLayout, QPushButton, QLabel, QScrollArea, QSizePolicy
from PySide6.QtCore import Qt, QSize
from PySide6.QtGui import QPixmap, QImage

# Attempt to import PySide6 PDF Viewer widgets
try:
    from PySide6.QtPdf import QPdfDocument
    from PySide6.QtPdfWidgets import QPdfView
    QT_PDF_AVAILABLE = True
except ImportError:
    QT_PDF_AVAILABLE = False

# Attempt to import pdf2image for image fallback
try:
    from pdf2image import convert_from_path
    PDF2IMAGE_AVAILABLE = True
except ImportError:
    PDF2IMAGE_AVAILABLE = False

class PDFViewerDialog(QDialog):
    def __init__(self, pdf_path, parent=None):
        super().__init__(parent)
        self.pdf_path = pdf_path
        self.setWindowTitle(f"PDF Preview - {os.path.basename(pdf_path)}")
        self.resize(800, 700)
        self.setModal(True)
        
        self.zoom_factor = 1.0
        self.setup_ui()
        
    def setup_ui(self):
        main_layout = QVBoxLayout(self)
        
        # --- Toolbar ---
        toolbar = QHBoxLayout()
        
        self.btn_open_external = QPushButton("Open in System Viewer")
        self.btn_open_external.clicked.connect(self.open_external)
        toolbar.addWidget(self.btn_open_external)
        
        toolbar.addStretch()
        
        self.btn_zoom_in = QPushButton("Zoom In (+)")
        self.btn_zoom_in.clicked.connect(self.zoom_in)
        self.btn_zoom_out = QPushButton("Zoom Out (-)")
        self.btn_zoom_out.clicked.connect(self.zoom_out)
        
        toolbar.addWidget(self.btn_zoom_out)
        toolbar.addWidget(self.btn_zoom_in)
        
        self.btn_close = QPushButton("Close")
        self.btn_close.clicked.connect(self.accept)
        toolbar.addWidget(self.btn_close)
        
        main_layout.addLayout(toolbar)
        
        # --- Content Area ---
        self.scroll_area = QScrollArea()
        self.scroll_area.setWidgetResizable(True)
        main_layout.addWidget(self.scroll_area)
        
        # Try native Qt PDF viewer first
        if QT_PDF_AVAILABLE:
            try:
                self.pdf_view = QPdfView()
                self.pdf_doc = QPdfDocument(self)
                self.pdf_doc.load(self.pdf_path)
                self.pdf_view.setDocument(self.pdf_doc)
                self.scroll_area.setWidget(self.pdf_view)
                return
            except Exception as e:
                print(f"Native PDF loading failed, trying fallback: {e}")
                
        # Image Fallback using pdf2image (if poppler is installed and available)
        if PDF2IMAGE_AVAILABLE:
            try:
                # Render only the first 2 pages for quick preview
                images = convert_from_path(self.pdf_path, first_page=1, last_page=2)
                if images:
                    container = QLabel()
                    container.setAlignment(Qt.AlignCenter)
                    
                    # Merge images vertically or just show the first page
                    # For simplicity, we show the first page, and write a helper if multiple
                    img = images[0]
                    img_data = img.tobytes("raw", "RGBA")
                    qim = QImage(img_data, img.size[0], img.size[1], QImage.Format_RGBA8888)
                    self.pixmap = QPixmap.fromImage(qim)
                    
                    container.setPixmap(self.pixmap.scaled(
                        QSize(760, int(760 * img.size[1] / img.size[0])),
                        Qt.KeepAspectRatio,
                        Qt.SmoothTransformation
                    ))
                    self.scroll_area.setWidget(container)
                    self.preview_label = container
                    return
            except Exception as e:
                print(f"pdf2image fallback failed: {e}")
                
        # Final Fallback: Simple messaging & button
        fallback_widget = QLabel(
            "<h3>PDF Preview Unavailable</h3>"
            "<p>A native PDF viewer is not compiled into this Python/PySide6 environment, "
            "or the document could not be converted to images.</p>"
            "<p>Please click the button in the top left to open the file in your default system PDF reader.</p>"
        )
        fallback_widget.setAlignment(Qt.AlignCenter)
        fallback_widget.setStyleSheet("color: #a0aec0; padding: 40px;")
        self.scroll_area.setWidget(fallback_widget)
        self.btn_zoom_in.setEnabled(False)
        self.btn_zoom_out.setEnabled(False)
        
    def zoom_in(self):
        self.zoom_factor *= 1.2
        self.apply_zoom()
        
    def zoom_out(self):
        self.zoom_factor /= 1.2
        self.apply_zoom()
        
    def apply_zoom(self):
        if QT_PDF_AVAILABLE and hasattr(self, 'pdf_view'):
            self.pdf_view.setZoomFactor(self.zoom_factor)
        elif hasattr(self, 'preview_label') and hasattr(self, 'pixmap'):
            w = int(760 * self.zoom_factor)
            h = int(self.pixmap.height() * w / self.pixmap.width())
            self.preview_label.setPixmap(self.pixmap.scaled(
                QSize(w, h),
                Qt.KeepAspectRatio,
                Qt.SmoothTransformation
            ))
            
    def open_external(self):
        try:
            os.startfile(self.pdf_path)
        except Exception as e:
            print(f"Error opening file externally: {e}")
