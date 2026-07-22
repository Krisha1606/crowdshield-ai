import matplotlib.pyplot as plt
import matplotlib.patches as patches

def create_flowchart(output_png, output_svg):
    # Set up figure with academic aspect ratio (vertical A4 proportion)
    fig_width = 9.0
    fig_height = 16.5
    dpi = 300
    
    fig, ax = plt.subplots(figsize=(fig_width, fig_height), dpi=dpi)
    ax.set_xlim(0, 100)
    ax.set_ylim(-20, 175)
    ax.axis('off')
    
    # Background color
    fig.patch.set_facecolor('#FFFFFF')
    ax.set_facecolor('#FFFFFF')

    # Color Palette - Professional Academic Blue & White
    COLOR_TITLE = '#0F172A'          # Dark Slate
    COLOR_SUBTITLE = '#475569'       # Slate Gray
    COLOR_START_END = '#1E3A8A'     # Deep Navy Blue
    COLOR_BOX_FILL = '#F8FAFC'      # Very Light Blue-Gray Card Fill
    COLOR_BOX_BORDER = '#2563EB'    # Vibrant Royal Blue Border
    COLOR_HIGHLIGHT_FILL = '#EFF6FF'# Light Blue Fill for ML Engine
    COLOR_HIGHLIGHT_BORDER = '#1D4ED8' # Deep Blue Border for ML Engine
    COLOR_HEADER_FILL = '#DBEAFE'   # Soft Blue Header Fill
    COLOR_HEADER_TEXT = '#1E3A8A'   # Navy Blue Header Text
    COLOR_TEXT_MAIN = '#0F172A'     # Dark Text
    COLOR_TEXT_MUTED = '#334155'    # Slate Gray Bullet Text
    COLOR_ARROW = '#2563EB'         # Royal Blue Arrow
    COLOR_SHADOW = '#E2E8F0'        # Soft Drop Shadow

    # Title & Caption (Academic Report Style)
    plt.text(50, 169, "Figure 1 – Crowd Monitoring and AI Prediction Workflow", 
             ha='center', va='center', fontsize=15, fontweight='bold', color=COLOR_TITLE, family='sans-serif')
    plt.text(50, 165.2, "Project: CrowdShield AI • System Flowchart", 
             ha='center', va='center', fontsize=11, fontweight='semibold', color=COLOR_SUBTITLE, family='sans-serif')

    # Node definitions
    # Format: (id, type, title, bullets, center_y, box_width, box_height)
    nodes = [
        ("start", "pill", "START", [], 156, 34, 5.5),
        ("step1", "rect", "Event Organizer Starts Simulation", [], 144, 64, 5.8),
        ("step2", "rect", "Simulation Engine Generates Live Crowd Data", [], 132, 70, 5.8),
        ("step3", "bullet_rect", "Collect Gate Metrics", 
         ["• Occupancy", "• Queue Length", "• Crowd Movement", "• Volunteer Availability"], 111, 70, 19.5),
        ("step4", "rect", "Preprocess Data", [], 94, 64, 5.8),
        ("step5", "rect_highlight", "Machine Learning Prediction Engine", [], 82, 70, 6.5),
        ("step6", "bullet_rect", "Predict", 
         ["• Waiting Time", "• Congestion Level", "• Risk Level", "• Safety Score", "• Required Volunteers"], 59, 70, 22.5),
        ("step7", "rect", "Store Results in Database", [], 40, 64, 5.8),
        ("step8", "rect", "Update Dashboard", [], 28, 64, 5.8),
        ("step9", "bullet_rect", "Display", 
         ["• Live Gate Status", "• AI Predictions", "• Charts", "• Analytics", "• Alerts"], 5, 70, 22.5),
        ("end", "pill", "END", [], -14, 34, 5.5)
    ]

    # Helper to draw rounded rectangle with shadow
    def draw_rounded_rect(cx, cy, width, height, bg_color, border_color, border_width=1.6, corner_radius=1.8):
        x = cx - width / 2.0
        y = cy - height / 2.0
        
        # Soft shadow offset
        shadow = patches.FancyBboxPatch(
            (x + 0.4, y - 0.4), width, height,
            boxstyle=f"round,pad=0,rounding_size={corner_radius}",
            linewidth=0, edgecolor='none', facecolor=COLOR_SHADOW, zorder=1
        )
        ax.add_patch(shadow)

        # Foreground box
        rect = patches.FancyBboxPatch(
            (x, y), width, height,
            boxstyle=f"round,pad=0,rounding_size={corner_radius}",
            linewidth=border_width, edgecolor=border_color, facecolor=bg_color, zorder=2
        )
        ax.add_patch(rect)
        return x, y

    # Helper to draw pill shape for START/END
    def draw_pill(cx, cy, width, height, text):
        x = cx - width / 2.0
        y = cy - height / 2.0

        shadow = patches.FancyBboxPatch(
            (x + 0.4, y - 0.4), width, height,
            boxstyle=f"round,pad=0,rounding_size={height/2.0}",
            linewidth=0, edgecolor='none', facecolor=COLOR_SHADOW, zorder=1
        )
        ax.add_patch(shadow)

        pill = patches.FancyBboxPatch(
            (x, y), width, height,
            boxstyle=f"round,pad=0,rounding_size={height/2.0}",
            linewidth=1.8, edgecolor='#1E3A8A', facecolor=COLOR_START_END, zorder=2
        )
        ax.add_patch(pill)

        ax.text(cx, cy, text, ha='center', va='center', fontsize=12, fontweight='bold', 
                color='#FFFFFF', zorder=3, family='sans-serif')

    # Render all nodes
    node_coords = {}
    for node_id, n_type, title, bullets, cy, w, h in nodes:
        node_coords[node_id] = (50, cy, w, h)
        
        if n_type == "pill":
            draw_pill(50, cy, w, h, title)
        elif n_type == "rect":
            draw_rounded_rect(50, cy, w, h, COLOR_BOX_FILL, COLOR_BOX_BORDER)
            ax.text(50, cy, title, ha='center', va='center', fontsize=11, fontweight='bold', 
                    color=COLOR_TEXT_MAIN, zorder=3, family='sans-serif')
        elif n_type == "rect_highlight":
            draw_rounded_rect(50, cy, w, h, COLOR_HIGHLIGHT_FILL, COLOR_HIGHLIGHT_BORDER, border_width=2.2)
            ax.text(50, cy, title, ha='center', va='center', fontsize=11.5, fontweight='bold', 
                    color='#1E3A8A', zorder=3, family='sans-serif')
        elif n_type == "bullet_rect":
            x, y = draw_rounded_rect(50, cy, w, h, '#FFFFFF', COLOR_BOX_BORDER, border_width=1.6)
            
            # Header pill box inside
            header_h = 4.2
            header_y = y + h - header_h - 1.2
            header_w = w - 4.0
            header_x = 50 - header_w / 2.0
            
            hdr_patch = patches.FancyBboxPatch(
                (header_x, header_y), header_w, header_h,
                boxstyle="round,pad=0,rounding_size=1.2",
                linewidth=0, edgecolor='none', facecolor=COLOR_HEADER_FILL, zorder=3
            )
            ax.add_patch(hdr_patch)
            
            ax.text(50, header_y + (header_h / 2.0), title, ha='center', va='center', 
                    fontsize=11, fontweight='bold', color=COLOR_HEADER_TEXT, zorder=4, family='sans-serif')
            
            # Render bullet points with ample padding
            bullet_start_y = header_y - 2.8
            line_spacing = 3.1
            for idx, bullet in enumerate(bullets):
                by = bullet_start_y - (idx * line_spacing)
                ax.text(50 - (w/2.0) + 6, by, bullet, ha='left', va='center', 
                        fontsize=9.8, fontweight='medium', color=COLOR_TEXT_MUTED, zorder=4, family='sans-serif')

    # Draw vertical connection arrows
    connections = [
        ("start", "step1"),
        ("step1", "step2"),
        ("step2", "step3"),
        ("step3", "step4"),
        ("step4", "step5"),
        ("step5", "step6"),
        ("step6", "step7"),
        ("step7", "step8"),
        ("step8", "step9"),
        ("step9", "end"),
    ]

    for src, dst in connections:
        src_x, src_y, src_w, src_h = node_coords[src]
        dst_x, dst_y, dst_w, dst_h = node_coords[dst]
        
        y_start = src_y - (src_h / 2.0) - 0.2
        y_end = dst_y + (dst_h / 2.0) + 0.2
        
        ax.annotate(
            "",
            xy=(50, y_end),             # Arrow tip
            xytext=(50, y_start),       # Arrow base
            arrowprops=dict(
                arrowstyle="-|>",
                color=COLOR_ARROW,
                linewidth=2.0,
                mutation_scale=14,
                shrinkA=0,
                shrinkB=0
            ),
            zorder=5
        )

    plt.tight_layout()
    plt.savefig(output_png, format='png', dpi=dpi, bbox_inches='tight', pad_inches=0.3, facecolor=fig.get_facecolor(), edgecolor='none')
    plt.savefig(output_svg, format='svg', bbox_inches='tight', pad_inches=0.3, facecolor=fig.get_facecolor(), edgecolor='none')
    plt.close()
    print(f"Flowchart successfully saved to {output_png} and {output_svg}")

if __name__ == "__main__":
    create_flowchart("assets/crowdshield_ai_workflow.png", "assets/crowdshield_ai_workflow.svg")
    create_flowchart("docs/crowdshield_ai_workflow.png", "docs/crowdshield_ai_workflow.svg")
