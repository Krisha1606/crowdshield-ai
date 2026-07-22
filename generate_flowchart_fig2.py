import matplotlib.pyplot as plt
import matplotlib.patches as patches

def create_fig2_flowchart(output_png, output_svg):
    fig_width = 9.5
    fig_height = 16.5
    dpi = 300
    
    fig, ax = plt.subplots(figsize=(fig_width, fig_height), dpi=dpi)
    ax.set_xlim(0, 100)
    ax.set_ylim(15, 208)
    ax.axis('off')
    
    # Background color
    fig.patch.set_facecolor('#FFFFFF')
    ax.set_facecolor('#FFFFFF')

    # Color Palette - Professional Academic Blue & White
    COLOR_TITLE = '#0F172A'          # Dark Slate
    COLOR_SUBTITLE = '#475569'       # Slate Gray
    COLOR_START_END = '#1E3A8A'     # Deep Navy Blue
    COLOR_BOX_FILL = '#F8FAFC'      # Light Blue-Gray Card Fill
    COLOR_BOX_BORDER = '#2563EB'    # Royal Blue Border
    COLOR_DIAMOND_FILL = '#EFF6FF'  # Light Blue Fill for Decision Diamonds
    COLOR_DIAMOND_BORDER = '#1D4ED8'# Darker Blue Border for Diamonds
    COLOR_TEXT_MAIN = '#0F172A'     # Dark Text
    COLOR_ARROW = '#2563EB'         # Royal Blue Arrow
    COLOR_SHADOW = '#E2E8F0'        # Soft Drop Shadow
    COLOR_LABEL_YES = '#047857'     # Emerald Green label for YES
    COLOR_LABEL_NO = '#B91C1C'      # Deep Red label for NO

    # Title & Caption
    plt.text(50, 202, "Figure 2 – Volunteer Allocation and Alert Management Workflow", 
             ha='center', va='center', fontsize=14.5, fontweight='bold', color=COLOR_TITLE, family='sans-serif')
    plt.text(50, 198.2, "Project: CrowdShield AI • Adaptive Resource Allocation", 
             ha='center', va='center', fontsize=11, fontweight='semibold', color=COLOR_SUBTITLE, family='sans-serif')

    # Helper function to draw rounded rect
    def draw_rounded_rect(cx, cy, width, height, bg_color, border_color, border_width=1.6, corner_radius=1.8):
        x = cx - width / 2.0
        y = cy - height / 2.0
        
        shadow = patches.FancyBboxPatch(
            (x + 0.4, y - 0.4), width, height,
            boxstyle=f"round,pad=0,rounding_size={corner_radius}",
            linewidth=0, edgecolor='none', facecolor=COLOR_SHADOW, zorder=1
        )
        ax.add_patch(shadow)

        rect = patches.FancyBboxPatch(
            (x, y), width, height,
            boxstyle=f"round,pad=0,rounding_size={corner_radius}",
            linewidth=border_width, edgecolor=border_color, facecolor=bg_color, zorder=2
        )
        ax.add_patch(rect)
        return x, y

    # Helper function to draw pill (Start/End)
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

        ax.text(cx, cy, text, ha='center', va='center', fontsize=11.5, fontweight='bold', 
                color='#FFFFFF', zorder=3, family='sans-serif')

    # Helper function to draw decision diamond
    def draw_diamond(cx, cy, width, height, text):
        hw = width / 2.0
        hh = height / 2.0
        
        shadow_pts = [[cx + 0.4, cy + hh - 0.4], [cx + hw + 0.4, cy - 0.4], 
                      [cx + 0.4, cy - hh - 0.4], [cx - hw + 0.4, cy - 0.4]]
        shadow = patches.Polygon(shadow_pts, closed=True, linewidth=0, edgecolor='none', 
                                 facecolor=COLOR_SHADOW, zorder=1)
        ax.add_patch(shadow)

        pts = [[cx, cy + hh], [cx + hw, cy], [cx, cy - hh], [cx - hw, cy]]
        diamond = patches.Polygon(pts, closed=True, linewidth=2.0, edgecolor=COLOR_DIAMOND_BORDER, 
                                  facecolor=COLOR_DIAMOND_FILL, zorder=2)
        ax.add_patch(diamond)

        ax.text(cx, cy, text, ha='center', va='center', fontsize=10.5, fontweight='bold', 
                color='#1E3A8A', zorder=3, family='sans-serif', multialignment='center')

    # Helper arrow
    def draw_arrow(x1, y1, x2, y2, z=5):
        ax.annotate(
            "", xy=(x2, y2), xytext=(x1, y1),
            arrowprops=dict(arrowstyle="-|>", color=COLOR_ARROW, linewidth=2.0, mutation_scale=14, shrinkA=0, shrinkB=0),
            zorder=z
        )

    # --- MAIN COLUMN (X = 38) ---
    X_MAIN = 38
    X_RIGHT = 82
    W_MAIN = 52
    W_RIGHT = 30

    # 1. START
    draw_pill(X_MAIN, 189, 32, 5.5, "START")
    
    # 2. Receive AI Prediction
    draw_rounded_rect(X_MAIN, 177, W_MAIN, 5.8, COLOR_BOX_FILL, COLOR_BOX_BORDER)
    ax.text(X_MAIN, 177, "Receive AI Prediction", ha='center', va='center', fontsize=11, fontweight='bold', color=COLOR_TEXT_MAIN)

    # 3. Check Required Volunteers
    draw_rounded_rect(X_MAIN, 165, W_MAIN, 5.8, COLOR_BOX_FILL, COLOR_BOX_BORDER)
    ax.text(X_MAIN, 165, "Check Required Volunteers", ha='center', va='center', fontsize=11, fontweight='bold', color=COLOR_TEXT_MAIN)

    # 4. Decision: Volunteer Deficit?
    draw_diamond(X_MAIN, 148, 36, 13.0, "Volunteer\nDeficit?")

    # --- NO Branch 1 (Right to X_RIGHT = 82) ---
    draw_rounded_rect(X_RIGHT, 148, W_RIGHT, 5.8, COLOR_BOX_FILL, COLOR_BOX_BORDER)
    ax.text(X_RIGHT, 148, "Maintain Current\nAssignment", ha='center', va='center', fontsize=9.8, fontweight='bold', color=COLOR_TEXT_MAIN)

    draw_rounded_rect(X_RIGHT, 134, W_RIGHT, 5.8, COLOR_BOX_FILL, COLOR_BOX_BORDER)
    ax.text(X_RIGHT, 134, "Update Dashboard", ha='center', va='center', fontsize=10, fontweight='bold', color=COLOR_TEXT_MAIN)

    draw_pill(X_RIGHT, 121, 26, 5.2, "END")

    # Arrows for NO Branch 1
    draw_arrow(56.2, 148, 66.8, 148)
    ax.text(61.5, 150.0, "NO", ha='center', va='bottom', fontsize=10.5, fontweight='bold', color=COLOR_LABEL_NO)
    draw_arrow(X_RIGHT, 145.1, X_RIGHT, 137.1)
    draw_arrow(X_RIGHT, 131.1, X_RIGHT, 123.8)

    # --- YES Branch 1 (Down column X_MAIN = 38) ---
    draw_arrow(X_MAIN, 141.3, X_MAIN, 133.1)
    ax.text(X_MAIN + 2.2, 137.5, "YES", ha='left', va='center', fontsize=10.5, fontweight='bold', color=COLOR_LABEL_YES)

    # 5. Find Available Volunteers
    draw_rounded_rect(X_MAIN, 130, W_MAIN, 5.8, COLOR_BOX_FILL, COLOR_BOX_BORDER)
    ax.text(X_MAIN, 130, "Find Available Volunteers", ha='center', va='center', fontsize=11, fontweight='bold', color=COLOR_TEXT_MAIN)

    # 6. Assign Volunteers to High Priority Gate
    draw_rounded_rect(X_MAIN, 118, W_MAIN, 5.8, COLOR_BOX_FILL, COLOR_BOX_BORDER)
    ax.text(X_MAIN, 118, "Assign Volunteers to High Priority Gate", ha='center', va='center', fontsize=10.5, fontweight='bold', color=COLOR_TEXT_MAIN)

    # 7. Update Volunteer Status
    draw_rounded_rect(X_MAIN, 106, W_MAIN, 5.8, COLOR_BOX_FILL, COLOR_BOX_BORDER)
    ax.text(X_MAIN, 106, "Update Volunteer Status", ha='center', va='center', fontsize=11, fontweight='bold', color=COLOR_TEXT_MAIN)

    # 8. Generate Notifications
    draw_rounded_rect(X_MAIN, 94, W_MAIN, 5.8, COLOR_BOX_FILL, COLOR_BOX_BORDER)
    ax.text(X_MAIN, 94, "Generate Notifications", ha='center', va='center', fontsize=11, fontweight='bold', color=COLOR_TEXT_MAIN)

    # 9. Update Dashboard
    draw_rounded_rect(X_MAIN, 82, W_MAIN, 5.8, COLOR_BOX_FILL, COLOR_BOX_BORDER)
    ax.text(X_MAIN, 82, "Update Dashboard", ha='center', va='center', fontsize=11, fontweight='bold', color=COLOR_TEXT_MAIN)

    # Arrows in main stream
    draw_arrow(X_MAIN, 186.2, X_MAIN, 180.1)
    draw_arrow(X_MAIN, 174.1, X_MAIN, 168.1)
    draw_arrow(X_MAIN, 162.1, X_MAIN, 154.7)
    draw_arrow(X_MAIN, 127.1, X_MAIN, 121.1)
    draw_arrow(X_MAIN, 115.1, X_MAIN, 109.1)
    draw_arrow(X_MAIN, 103.1, X_MAIN, 97.1)
    draw_arrow(X_MAIN, 91.1, X_MAIN, 85.1)

    # 10. Decision 2: Risk Level High?
    draw_diamond(X_MAIN, 65, 36, 13.0, "Risk Level\nHigh?")
    draw_arrow(X_MAIN, 79.1, X_MAIN, 71.7)

    # --- NO Branch 2 (Right to X_RIGHT = 82) ---
    draw_rounded_rect(X_RIGHT, 65, W_RIGHT, 5.8, COLOR_BOX_FILL, COLOR_BOX_BORDER)
    ax.text(X_RIGHT, 65, "Continue\nMonitoring", ha='center', va='center', fontsize=10, fontweight='bold', color=COLOR_TEXT_MAIN)

    draw_pill(X_RIGHT, 51, 26, 5.2, "END")

    draw_arrow(56.2, 65, 66.8, 65)
    ax.text(61.5, 67.0, "NO", ha='center', va='bottom', fontsize=10.5, fontweight='bold', color=COLOR_LABEL_NO)
    draw_arrow(X_RIGHT, 62.1, X_RIGHT, 53.8)

    # --- YES Branch 2 (Down column X_MAIN = 38) ---
    draw_arrow(X_MAIN, 58.3, X_MAIN, 50.1)
    ax.text(X_MAIN + 2.2, 54.5, "YES", ha='left', va='center', fontsize=10.5, fontweight='bold', color=COLOR_LABEL_YES)

    # 11. Generate Safety Alert
    draw_rounded_rect(X_MAIN, 47, W_MAIN, 5.8, COLOR_BOX_FILL, COLOR_BOX_BORDER)
    ax.text(X_MAIN, 47, "Generate Safety Alert", ha='center', va='center', fontsize=11, fontweight='bold', color=COLOR_TEXT_MAIN)

    # 12. Notify Event Organizer
    draw_rounded_rect(X_MAIN, 35, W_MAIN, 5.8, COLOR_BOX_FILL, COLOR_BOX_BORDER)
    ax.text(X_MAIN, 35, "Notify Event Organizer", ha='center', va='center', fontsize=11, fontweight='bold', color=COLOR_TEXT_MAIN)

    # 13. END
    draw_pill(X_MAIN, 21, 32, 5.5, "END")

    draw_arrow(X_MAIN, 44.1, X_MAIN, 38.1)
    draw_arrow(X_MAIN, 32.1, X_MAIN, 24.0)

    plt.tight_layout()
    plt.savefig(output_png, format='png', dpi=dpi, bbox_inches='tight', pad_inches=0.3, facecolor=fig.get_facecolor(), edgecolor='none')
    plt.savefig(output_svg, format='svg', bbox_inches='tight', pad_inches=0.3, facecolor=fig.get_facecolor(), edgecolor='none')
    plt.close()
    print(f"Figure 2 saved to {output_png} and {output_svg}")

if __name__ == "__main__":
    create_fig2_flowchart("assets/crowdshield_ai_volunteer_workflow.png", "assets/crowdshield_ai_volunteer_workflow.svg")
    create_fig2_flowchart("docs/crowdshield_ai_volunteer_workflow.png", "docs/crowdshield_ai_volunteer_workflow.svg")
