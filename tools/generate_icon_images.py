import os
import json
import math
from PIL import Image, ImageDraw

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
IMAGE_DIR = os.path.join(ROOT, "web", "images")
VOCAB_PATH = os.path.join(ROOT, "web", "image-vocab.json")

# Define words for Grids 17 to 20
GRIDS_C = {
    17: [
        ("C1", "ambivalence", "two arrows pointing opposite directions (left and right), one red, one blue"),
        ("C1", "paradox", "an impossible Penrose triangle shape in blue lines"),
        ("C1", "irony", "a smiley face with a single tear drop, or a rain cloud over a sun"),
        ("C1", "figurative", "a heart shape made of two interlocking puzzle pieces"),
        ("C1", "abstraction", "an abstract composition of a yellow circle, blue rectangle, and red line"),
        ("C1", "subjectivity", "three overlapping circles of red, green, and blue (Venn diagram)"),
        ("C1", "objectivity", "a clean black ruler next to a target crosshair"),
        ("C1", "relativity", "a clock shape with skewed hands and a lightbeam line"),
        ("C1", "absoluteness", "a solid lock icon in bold black"),
        ("C1", "universality", "a simplified outline of the globe with latitude and longitude lines"),
        ("C1", "specificity", "a target board with a single red dot at the bullseye"),
        ("C1", "essentially", "a seed inside a shell, or a diamond inside a rock"),
        ("C1", "ostensibly", "a friendly face mask covering a neutral face"),
        ("C1", "in depth", "a magnifying glass focusing closely on detailed grid lines"),
        ("C1", "superficially", "a paintbrush painting a thin blue layer on a surface"),
        ("C1", "subtly", "a very thin, delicate gradient line fading out")
    ],
    18: [
        ("C1", "manifestly", "a bright glowing yellow sun with rays"),
        ("C1", "tacitly", "a finger holding over lips (silence gesture)"),
        ("C1", "explicitly", "a bold megaphone icon with sound waves"),
        ("C1", "ambiguously", "a question mark merged with an exclamation mark"),
        ("C1", "lucidly", "a bright glowing lightbulb with a clean outline"),
        ("C1", "systematically", "a flowchart diagram showing three boxes connected by arrows in order"),
        ("C1", "comprehensively", "a large circle containing many smaller shapes, fully enclosing them"),
        ("C1", "partially", "a circle with only a 25% slice colored in blue"),
        ("C1", "evenly", "a balance scale perfectly centered and balanced"),
        ("C1", "extremely", "a thermometer with a red level pushed to the very top"),
        ("C1", "moderately", "a dial pointer pointing directly to the middle green zone"),
        ("C1", "radically", "a tree showing deep roots or a lightning bolt splitting a block"),
        ("C1", "conservatively", "a shield protecting a small plant or box"),
        ("C1", "progressively", "stair steps climbing upwards with a green arrow pointing up"),
        ("C1", "traditionally", "a traditional Chinese lantern or classic column"),
        ("C1", "contemporarily", "a modern abstract geometric building or mobile device shape")
    ],
    19: [
        ("C2", "ubiquitously", "many small yellow stars scattered all over the canvas"),
        ("C2", "seldom", "a single lonely grey star in the center of the canvas"),
        ("C2", "uniquely", "three identical grey circles and one standout gold star"),
        ("C2", "ordinarily", "a neat grid of identical grey squares"),
        ("C2", "remarkably", "a single red diamond outstanding in a grid of grey squares"),
        ("C2", "excellently", "a golden crown icon"),
        ("C2", "mediocrely", "a flat horizontal grey line, representing average"),
        ("C2", "eminently", "a podium with a character standing high on the first place spot"),
        ("C2", "abysmally", "an arrow pointing down into a dark pit or crack"),
        ("C2", "exquisitely", "a beautifully detailed diamond icon with sparkles"),
        ("C2", "vulgarly", "a messy splash of dark ink or paint"),
        ("C2", "elegantly", "a graceful single flowing curved line like a ribbon"),
        ("C2", "sloppily", "a messy, crookedly drawn rectangle with ink leaks"),
        ("C2", "circumspectly", "an eye peering through a shield, looking around"),
        ("C2", "recklessly", "a cartoon car driving fast off a cliff edge"),
        ("C2", "cunningly", "a cartoon fox face or two eyes peeking out of the dark")
    ],
    20: [
        ("C2", "naively", "a simple baby face with wide eyes and a smile"),
        ("C2", "sophisticatedly", "a high-tech circuit board pattern or gears"),
        ("C2", "ingenuously", "a seedling growing out of the ground, pure and simple"),
        ("C2", "hypocritically", "a face split in half, one half smiling, the other half frowning"),
        ("C2", "sincerely", "a large red heart in the center"),
        ("C2", "affectedly", "a puppet on strings or a fake plastic flower"),
        ("C2", "unassumingly", "a tiny sprout next to a giant tree, looking humble"),
        ("C2", "arrogantly", "a nose pointed up at the sky in a proud pose"),
        ("C2", "obstinately", "a stubborn mule silhouette or a heavy anchor stuck in the ground"),
        ("C2", "affably", "a happy waving hand with a warm smile"),
        ("C2", "reclusively", "a small cabin house isolated on a tiny island"),
        ("C2", "extrovertedly", "multiple arrows bursting outward from the center"),
        ("C2", "introvertedly", "multiple arrows pointing inward to the center"),
        ("C2", "loquaciously", "a speech bubble containing many smaller bubbles"),
        ("C2", "taciturnly", "a speech bubble with a zipper or a lock on it"),
        ("C2", "verbosely", "a sheet of paper packed with tiny lines of text")
    ]
}

def draw_icon(draw, word):
    w, h = 128, 128
    
    # Border
    draw.rectangle([(0, 0), (w-1, h-1)], outline=(0, 0, 0), width=1)
    
    # Draw logic based on the word
    if word == "ambivalence":
        # Two opposite arrows
        draw.line([(30, 45), (98, 45)], fill=(200, 50, 50), width=4) # Red arrow right
        draw.polygon([(90, 37), (98, 45), (90, 53)], fill=(200, 50, 50))
        draw.line([(30, 80), (98, 80)], fill=(50, 50, 200), width=4) # Blue arrow left
        draw.polygon([(38, 72), (30, 80), (38, 88)], fill=(50, 50, 200))
        
    elif word == "paradox":
        # Penrose style triangle outline
        draw.polygon([(64, 20), (20, 100), (108, 100)], outline=(50, 50, 200), width=4)
        draw.polygon([(64, 45), (40, 85), (88, 85)], outline=(50, 50, 200), width=2)
        
    elif word == "irony":
        # Smiley face with a tear
        draw.ellipse([(34, 34), (94, 94)], outline=(0, 0, 0), width=3)
        draw.ellipse([(48, 50), (54, 56)], fill=(0, 0, 0))
        draw.ellipse([(74, 50), (80, 56)], fill=(0, 0, 0))
        # smile
        draw.arc([(48, 60), (80, 80)], 0, 180, fill=(0, 0, 0), width=3)
        # tear
        draw.polygon([(51, 58), (47, 68), (55, 68)], fill=(50, 150, 250))
        draw.ellipse([(47, 65), (55, 73)], fill=(50, 150, 250))
        
    elif word == "figurative":
        # Interlocking puzzle heart
        draw.ellipse([(34, 34), (64, 64)], fill=(200, 50, 50))
        draw.ellipse([(64, 34), (94, 64)], fill=(200, 50, 50))
        draw.polygon([(35, 50), (93, 50), (64, 95)], fill=(200, 50, 50))
        # Draw puzzle dividing line
        draw.line([(64, 34), (64, 95)], fill=(255, 255, 255), width=3)
        
    elif word == "abstraction":
        # Colorful abstract shapes
        draw.ellipse([(20, 20), (60, 60)], fill=(250, 200, 50))
        draw.rectangle([(50, 50), (100, 90)], fill=(50, 100, 200))
        draw.line([(10, 100), (110, 20)], fill=(200, 50, 50), width=4)
        
    elif word == "subjectivity":
        # Three overlapping circles (Venn)
        draw.ellipse([(34, 30), (74, 70)], outline=(200, 50, 50), width=3)
        draw.ellipse([(54, 50), (94, 90)], outline=(50, 200, 50), width=3)
        draw.ellipse([(24, 55), (64, 95)], outline=(50, 50, 200), width=3)
        
    elif word == "objectivity":
        # Ruler and crosshair
        draw.rectangle([(20, 90), (108, 110)], outline=(0, 0, 0), fill=(220, 220, 220), width=2)
        for x in range(30, 108, 10):
            draw.line([(x, 90), (x, 98)], fill=(0, 0, 0), width=1)
        draw.ellipse([(44, 30), (84, 70)], outline=(200, 50, 50), width=2)
        draw.line([(64, 20), (64, 80)], fill=(200, 50, 50), width=1)
        draw.line([(34, 50), (94, 50)], fill=(200, 50, 50), width=1)
        
    elif word == "relativity":
        # Skewed clock
        draw.ellipse([(34, 34), (94, 94)], outline=(0, 0, 0), width=3)
        draw.line([(64, 64), (64, 44)], fill=(0, 0, 0), width=3)
        draw.line([(64, 64), (84, 74)], fill=(0, 0, 0), width=2)
        # Warp speed lines
        draw.line([(10, 10), (30, 25)], fill=(180, 180, 180), width=2)
        draw.line([(100, 100), (118, 115)], fill=(180, 180, 180), width=2)
        
    elif word == "absoluteness":
        # Padlock
        draw.rectangle([(34, 54), (94, 104)], fill=(50, 50, 50))
        draw.arc([(44, 24), (84, 64)], 180, 360, fill=(50, 50, 50), width=8)
        draw.ellipse([(60, 70), (68, 78)], fill=(255, 255, 255))
        draw.polygon([(62, 78), (66, 78), (68, 90), (60, 90)], fill=(255, 255, 255))
        
    elif word == "universality":
        # Globe outline
        draw.ellipse([(24, 24), (104, 104)], outline=(50, 100, 200), width=3)
        draw.ellipse([(44, 24), (84, 104)], outline=(50, 100, 200), width=2)
        draw.line([(24, 64), (104, 64)], fill=(50, 100, 200), width=2)
        draw.arc([(24, 44), (104, 84)], 180, 360, fill=(50, 100, 200), width=1)
        draw.arc([(24, 44), (104, 84)], 0, 180, fill=(50, 100, 200), width=1)
        
    elif word == "specificity":
        # Target with red dot at center
        draw.ellipse([(24, 24), (104, 104)], outline=(180, 180, 180), width=2)
        draw.ellipse([(44, 44), (84, 84)], outline=(180, 180, 180), width=2)
        draw.ellipse([(59, 59), (69, 69)], fill=(200, 50, 50))
        
    elif word == "essentially":
        # Shell split open with glowing seed
        draw.ellipse([(24, 44), (104, 84)], outline=(100, 100, 100), width=3)
        draw.line([(24, 64), (104, 64)], fill=(100, 100, 100), width=2)
        draw.ellipse([(54, 54), (74, 74)], fill=(250, 200, 50))
        
    elif word == "ostensibly":
        # Face with mask
        draw.ellipse([(34, 40), (94, 100)], outline=(120, 120, 120), width=2)
        # draw a string mask
        draw.rectangle([(24, 50), (104, 75)], fill=(150, 200, 250), outline=(50, 100, 200))
        draw.line([(24, 62), (10, 62)], fill=(150, 150, 150), width=2)
        draw.line([(104, 62), (118, 62)], fill=(150, 150, 150), width=2)
        
    elif word == "in depth":
        # Magnifying glass on detailed grid
        for i in range(20, 108, 10):
            draw.line([(i, 20), (i, 108)], fill=(220, 220, 220), width=1)
            draw.line([(20, i), (108, i)], fill=(220, 220, 220), width=1)
        draw.ellipse([(44, 30), (94, 80)], outline=(0, 0, 0), width=3)
        draw.line([(85, 71), (110, 96)], fill=(0, 0, 0), width=6)
        
    elif word == "superficially":
        # Paint brush coating surface
        draw.rectangle([(20, 80), (108, 100)], fill=(50, 150, 250))
        # Brush
        draw.rectangle([(40, 30), (70, 70)], fill=(150, 100, 50))
        draw.rectangle([(36, 70), (74, 80)], fill=(200, 200, 200))
        
    elif word == "subtly":
        # Fine line fading
        for x in range(20, 108):
            alpha = int(255 * (1 - (x - 20) / 88))
            draw.line([(x, 64), (x+1, 64)], fill=(50, 100, 200, alpha), width=3)
            
    elif word == "manifestly":
        # Glowing sun
        draw.ellipse([(44, 44), (84, 84)], fill=(250, 200, 50))
        for angle in range(0, 360, 45):
            rad = math.radians(angle)
            x1 = int(64 + 25 * math.cos(rad))
            y1 = int(64 + 25 * math.sin(rad))
            x2 = int(64 + 40 * math.cos(rad))
            y2 = int(64 + 40 * math.sin(rad))
            draw.line([(x1, y1), (x2, y2)], fill=(250, 200, 50), width=3)
            
    elif word == "tacitly":
        # Shh finger on lips
        draw.ellipse([(44, 24), (84, 64)], outline=(0, 0, 0), width=3)
        draw.arc([(54, 50), (74, 58)], 0, 180, fill=(0, 0, 0), width=2)
        # Finger
        draw.rectangle([(60, 55), (68, 95)], fill=(220, 180, 150), outline=(0, 0, 0))
        
    elif word == "explicitly":
        # Megaphone
        draw.polygon([(30, 50), (65, 35), (65, 93), (30, 78)], fill=(200, 50, 50))
        draw.rectangle([(15, 60), (30, 75)], fill=(100, 100, 100))
        # Sound waves
        draw.arc([(60, 30), (90, 98)], 300, 60, fill=(0, 0, 0), width=3)
        draw.arc([(70, 20), (105, 108)], 300, 60, fill=(0, 0, 0), width=3)
        
    elif word == "ambiguously":
        # ? and ! mixed
        draw.arc([(34, 24), (94, 74)], 180, 360, fill=(150, 50, 200), width=6)
        draw.line([(94, 49), (94, 69)], fill=(150, 50, 200), width=6)
        draw.line([(94, 69), (64, 89)], fill=(150, 50, 200), width=6)
        draw.line([(64, 89), (64, 94)], fill=(150, 50, 200), width=6)
        draw.ellipse([(60, 102), (68, 110)], fill=(150, 50, 200))
        
    elif word == "lucidly":
        # Glowing bulb
        draw.ellipse([(44, 24), (84, 74)], fill=(250, 250, 200), outline=(0, 0, 0), width=2)
        draw.rectangle([(50, 74), (78, 86)], fill=(180, 180, 180), outline=(0, 0, 0))
        draw.line([(57, 44), (64, 34), (71, 44)], fill=(200, 150, 50), width=2)
        # Glow lines
        draw.line([(34, 24), (20, 14)], fill=(250, 200, 50), width=2)
        draw.line([(94, 24), (108, 14)], fill=(250, 200, 50), width=2)
        draw.line([(30, 49), (14, 49)], fill=(250, 200, 50), width=2)
        draw.line([(98, 49), (114, 49)], fill=(250, 200, 50), width=2)
        
    elif word == "systematically":
        # Flowchart
        draw.rectangle([(15, 49), (40, 79)], fill=(240, 240, 240), outline=(0, 0, 0), width=2)
        draw.rectangle([(51, 49), (76, 79)], fill=(240, 240, 240), outline=(0, 0, 0), width=2)
        draw.rectangle([(87, 49), (112, 79)], fill=(240, 240, 240), outline=(0, 0, 0), width=2)
        draw.line([(40, 64), (51, 64)], fill=(0, 0, 0), width=2)
        draw.line([(76, 64), (87, 64)], fill=(0, 0, 0), width=2)
        
    elif word == "comprehensively":
        # Giant circle enclosing small items
        draw.ellipse([(20, 20), (108, 108)], outline=(50, 150, 50), width=3)
        draw.ellipse([(34, 44), (49, 59)], fill=(200, 50, 50))
        draw.rectangle([(74, 34), (89, 49)], fill=(50, 50, 200))
        draw.polygon([(54, 74), (69, 74), (61, 89)], fill=(250, 200, 50))
        
    elif word == "partially":
        # 25% slice pie chart
        draw.ellipse([(24, 24), (104, 104)], outline=(0, 0, 0), width=3)
        draw.pieslice([(24, 24), (104, 104)], 270, 360, fill=(50, 100, 200))
        
    elif word == "evenly":
        # Balanced scale
        draw.line([(64, 20), (64, 100)], fill=(0, 0, 0), width=3)
        draw.line([(24, 40), (104, 40)], fill=(0, 0, 0), width=3) # Beam
        draw.line([(24, 100), (104, 100)], fill=(0, 0, 0), width=4) # Base
        # Hanging pans
        draw.line([(24, 40), (24, 70)], fill=(100, 100, 100), width=2)
        draw.arc([(14, 60), (34, 80)], 0, 180, fill=(100, 100, 100), width=2)
        draw.line([(104, 40), (104, 70)], fill=(100, 100, 100), width=2)
        draw.arc([(94, 60), (114, 80)], 0, 180, fill=(100, 100, 100), width=2)
        
    elif word == "extremely":
        # Max thermometer
        draw.rectangle([(54, 20), (74, 100)], outline=(0, 0, 0), fill=(255, 255, 255), width=2)
        draw.ellipse([(44, 90), (84, 118)], fill=(200, 50, 50), outline=(0, 0, 0), width=2)
        draw.rectangle([(55, 25), (73, 95)], fill=(200, 50, 50)) # Red mercury max
        
    elif word == "moderately":
        # Dial pointing middle
        draw.arc([(24, 34), (104, 114)], 180, 360, fill=(0, 0, 0), width=3)
        # middle pointer
        draw.line([(64, 74), (64, 40)], fill=(200, 50, 50), width=3)
        
    elif word == "radically":
        # Lightning splitting block
        draw.rectangle([(24, 70), (104, 100)], fill=(150, 150, 150))
        # lightning
        draw.polygon([(64, 15), (79, 50), (64, 50), (74, 85), (49, 45), (64, 45)], fill=(250, 200, 50))
        
    elif word == "conservatively":
        # Shield around a flower
        draw.ellipse([(54, 64), (74, 84)], fill=(100, 200, 100))
        # Shield outline
        draw.arc([(30, 20), (98, 100)], 0, 180, fill=(50, 100, 200), width=3)
        draw.line([(30, 20), (64, 10)], fill=(50, 100, 200), width=3)
        draw.line([(98, 20), (64, 10)], fill=(50, 100, 200), width=3)
        
    elif word == "progressively":
        # Steps with upward arrow
        draw.rectangle([(20, 90), (40, 108)], fill=(200, 200, 200))
        draw.rectangle([(40, 70), (60, 108)], fill=(180, 180, 180))
        draw.rectangle([(60, 50), (80, 108)], fill=(160, 160, 160))
        draw.rectangle([(80, 30), (100, 108)], fill=(140, 140, 140))
        # Upward green arrow
        draw.line([(25, 80), (85, 20)], fill=(50, 200, 50), width=4)
        draw.polygon([(85, 12), (90, 27), (77, 23)], fill=(50, 200, 50))
        
    elif word == "traditionally":
        # Red Chinese lantern
        draw.ellipse([(44, 34), (84, 94)], fill=(200, 50, 50))
        draw.rectangle([(50, 28), (78, 34)], fill=(250, 200, 50))
        draw.rectangle([(50, 94), (78, 100)], fill=(250, 200, 50))
        # Tassel lines
        draw.line([(64, 100), (64, 118)], fill=(250, 200, 50), width=2)
        
    elif word == "contemporarily":
        # Modern mobile phone outline
        draw.rectangle([(34, 20), (94, 108)], outline=(50, 50, 50), fill=(240, 240, 240), width=3)
        draw.ellipse([(60, 100), (68, 108)], outline=(0, 0, 0))
        # Abstract grid screen
        draw.rectangle([(40, 28), (88, 94)], fill=(50, 150, 250))
        
    elif word == "ubiquitously":
        # Stars everywhere
        import random
        random.seed(123)
        for _ in range(15):
            x = random.randint(15, 110)
            y = random.randint(15, 110)
            draw.ellipse([(x, y), (x+6, y+6)], fill=(250, 200, 50))
            
    elif word == "seldom":
        # One single star
        draw.ellipse([(59, 59), (69, 69)], fill=(150, 150, 150))
        
    elif word == "uniquely":
        # Three circles, one gold star
        draw.ellipse([(24, 40), (39, 55)], fill=(180, 180, 180))
        draw.ellipse([(54, 40), (69, 55)], fill=(180, 180, 180))
        draw.ellipse([(84, 40), (99, 55)], fill=(180, 180, 180))
        # standalone golden star/circle
        draw.ellipse([(54, 80), (74, 100)], fill=(250, 200, 50))
        
    elif word == "ordinarily":
        # Grid of identical squares
        for r in range(3):
            for c in range(3):
                draw.rectangle([(25 + c*30, 25 + r*30), (45 + c*30, 45 + r*30)], fill=(180, 180, 180))
                
    elif word == "remarkably":
        # Grid of identical squares, one red diamond
        for r in range(3):
            for c in range(3):
                if r == 1 and c == 1:
                    # Diamond
                    draw.polygon([(64, 45), (74, 55), (64, 65), (54, 55)], fill=(200, 50, 50))
                else:
                    draw.rectangle([(25 + c*30, 25 + r*30), (45 + c*30, 45 + r*30)], fill=(180, 180, 180))
                    
    elif word == "excellently":
        # Crown
        draw.polygon([(30, 90), (30, 50), (48, 70), (64, 40), (80, 70), (98, 50), (98, 90)], fill=(250, 200, 50), outline=(0, 0, 0), width=2)
        draw.rectangle([(26, 90), (102, 98)], fill=(250, 200, 50), outline=(0, 0, 0), width=2)
        
    elif word == "mediocrely":
        # Flat line
        draw.line([(15, 64), (113, 64)], fill=(120, 120, 120), width=4)
        
    elif word == "eminently":
        # First place podium
        draw.rectangle([(44, 40), (84, 108)], fill=(250, 200, 50))
        draw.rectangle([(14, 60), (44, 108)], fill=(200, 200, 200))
        draw.rectangle([(84, 75), (114, 108)], fill=(205, 127, 50))
        
    elif word == "abysmally":
        # Pit pointing down
        draw.polygon([(20, 90), (108, 90), (64, 120)], fill=(0, 0, 0))
        draw.line([(64, 20), (64, 80)], fill=(200, 50, 50), width=3)
        draw.polygon([(60, 74), (64, 84), (68, 74)], fill=(200, 50, 50))
        
    elif word == "exquisitely":
        # Sparkly Diamond
        draw.polygon([(64, 30), (94, 55), (64, 100), (34, 55)], fill=(150, 220, 255), outline=(50, 100, 200), width=2)
        draw.line([(34, 55), (94, 55)], fill=(50, 100, 200), width=2)
        draw.line([(64, 30), (64, 100)], fill=(50, 100, 200), width=2)
        
    elif word == "vulgarly":
        # Messy paint splat
        draw.ellipse([(44, 44), (84, 84)], fill=(0, 0, 0))
        draw.ellipse([(34, 34), (49, 49)], fill=(0, 0, 0))
        draw.ellipse([(79, 79), (94, 94)], fill=(0, 0, 0))
        draw.line([(34, 34), (84, 84)], fill=(0, 0, 0), width=4)
        
    elif word == "elegantly":
        # Smooth ribbon curve
        for t in range(0, 100):
            x = int(64 + 35 * math.sin(t * 0.1))
            y = int(20 + t * 0.88)
            draw.ellipse([(x-2, y-2), (x+2, y+2)], fill=(255, 100, 150))
        
    elif word == "sloppily":
        # Messy rectangle with leaks
        draw.rectangle([(30, 30), (98, 98)], outline=(0, 0, 0), width=3)
        draw.line([(40, 98), (40, 115)], fill=(0, 0, 0), width=3)
        draw.line([(85, 98), (80, 110)], fill=(0, 0, 0), width=2)
        
    elif word == "circumspectly":
        # Eye looking around behind shield
        draw.ellipse([(44, 34), (84, 74)], outline=(0, 0, 0), width=2)
        draw.ellipse([(58, 48), (70, 60)], fill=(0, 0, 0)) # Pupil
        draw.rectangle([(20, 80), (108, 95)], fill=(120, 120, 120))
        
    elif word == "recklessly":
        # Car going off cliff
        draw.rectangle([(0, 80), (70, 127)], fill=(120, 120, 120)) # Cliff
        # Falling box representing car
        draw.rectangle([(75, 90), (105, 105)], fill=(200, 50, 50), outline=(0, 0, 0))
        draw.line([(70, 80), (95, 105)], fill=(180, 0, 0), width=2, joint=None)
        
    elif word == "cunningly":
        # Two eyes peeking out of dark
        draw.rectangle([(0, 0), (128, 128)], fill=(30, 30, 30))
        # Glow eyes
        draw.ellipse([(34, 54), (54, 64)], fill=(250, 200, 50))
        draw.ellipse([(42, 54), (46, 64)], fill=(0, 0, 0))
        draw.ellipse([(74, 54), (94, 64)], fill=(250, 200, 50))
        draw.ellipse([(82, 54), (86, 64)], fill=(0, 0, 0))
        
    elif word == "naively":
        # Simple baby face
        draw.ellipse([(34, 34), (94, 94)], outline=(0, 0, 0), width=3)
        draw.ellipse([(50, 52), (54, 56)], fill=(0, 0, 0))
        draw.ellipse([(74, 52), (78, 56)], fill=(0, 0, 0))
        draw.arc([(50, 60), (78, 80)], 0, 180, fill=(0, 0, 0), width=2)
        
    elif word == "sophisticatedly":
        # Complex gears
        draw.ellipse([(44, 44), (84, 84)], outline=(100, 100, 100), width=4)
        draw.ellipse([(54, 54), (74, 74)], fill=(100, 100, 100))
        for angle in range(0, 360, 30):
            rad = math.radians(angle)
            x1 = int(64 + 18 * math.cos(rad))
            y1 = int(64 + 18 * math.sin(rad))
            x2 = int(64 + 28 * math.cos(rad))
            y2 = int(64 + 28 * math.sin(rad))
            draw.line([(x1, y1), (x2, y2)], fill=(100, 100, 100), width=3)
            
    elif word == "ingenuously":
        # Small simple seedling sprout
        draw.line([(64, 108), (64, 44)], fill=(100, 50, 0), width=3)
        draw.ellipse([(44, 44), (64, 59)], fill=(100, 200, 100))
        draw.ellipse([(64, 34), (84, 49)], fill=(100, 200, 100))
        
    elif word == "hypocritically":
        # Split face
        draw.ellipse([(34, 34), (94, 94)], outline=(0, 0, 0), width=3)
        draw.line([(64, 34), (64, 94)], fill=(0, 0, 0), width=2)
        # Left half eye & smile
        draw.ellipse([(48, 52), (52, 56)], fill=(0, 0, 0))
        draw.arc([(48, 64), (64, 78)], 0, 180, fill=(0, 0, 0), width=2)
        # Right half eye & frown
        draw.ellipse([(76, 52), (80, 56)], fill=(0, 0, 0))
        draw.arc([(64, 68), (80, 82)], 180, 360, fill=(0, 0, 0), width=2)
        
    elif word == "sincerely":
        # Heart
        draw.ellipse([(34, 34), (64, 64)], fill=(200, 50, 50))
        draw.ellipse([(64, 34), (94, 64)], fill=(200, 50, 50))
        draw.polygon([(35, 50), (93, 50), (64, 95)], fill=(200, 50, 50))
        
    elif word == "affectedly":
        # Puppet crossbar
        draw.line([(34, 30), (94, 30)], fill=(150, 100, 50), width=4)
        draw.line([(64, 15), (64, 45)], fill=(150, 100, 50), width=4)
        # Strings
        draw.line([(34, 30), (34, 90)], fill=(180, 180, 180), width=1)
        draw.line([(94, 30), (94, 90)], fill=(180, 180, 180), width=1)
        draw.rectangle([(30, 90), (98, 110)], fill=(200, 200, 200))
        
    elif word == "unassumingly":
        # Tiny sprout next to big tree outline
        draw.rectangle([(20, 100), (108, 108)], fill=(100, 50, 0))
        # Big tree outline
        draw.line([(80, 100), (80, 40)], fill=(120, 120, 120), width=6)
        draw.ellipse([(60, 20), (100, 60)], outline=(120, 120, 120), width=2)
        # Tiny sprout
        draw.line([(35, 100), (35, 80)], fill=(50, 200, 50), width=2)
        draw.ellipse([(30, 80), (35, 86)], fill=(50, 200, 50))
        
    elif word == "arrogantly":
        # Proud nose pointed up
        draw.arc([(34, 54), (74, 94)], 90, 270, fill=(0, 0, 0), width=3)
        draw.line([(74, 54), (94, 34)], fill=(0, 0, 0), width=3)
        draw.line([(94, 34), (74, 34)], fill=(0, 0, 0), width=3)
        
    elif word == "obstinately":
        # Heavy anchor stuck
        draw.line([(64, 20), (64, 90)], fill=(50, 50, 50), width=4)
        draw.ellipse([(56, 10), (72, 26)], outline=(50, 50, 50), width=3)
        draw.arc([(34, 60), (94, 110)], 0, 180, fill=(50, 50, 50), width=6)
        draw.line([(25, 90), (30, 80)], fill=(50, 50, 50), width=4)
        draw.line([(103, 90), (98, 80)], fill=(50, 50, 50), width=4)
        
    elif word == "affably":
        # Waving hand
        draw.ellipse([(44, 60), (84, 100)], fill=(240, 200, 150))
        # Fingers
        for offset in [-12, -4, 4, 12]:
            draw.rectangle([(64 + offset - 2, 35), (64 + offset + 2, 65)], fill=(240, 200, 150))
            
    elif word == "reclusively":
        # Cabin on tiny island
        draw.ellipse([(34, 80), (94, 110)], fill=(250, 200, 100)) # Island
        # Cabin
        draw.rectangle([(50, 60), (78, 85)], fill=(150, 100, 50))
        draw.polygon([(46, 60), (82, 60), (64, 45)], fill=(200, 50, 50))
        
    elif word == "extrovertedly":
        # Bursting outward arrows
        for angle in range(0, 360, 45):
            rad = math.radians(angle)
            x1 = int(64 + 15 * math.cos(rad))
            y1 = int(64 + 15 * math.sin(rad))
            x2 = int(64 + 48 * math.cos(rad))
            y2 = int(64 + 48 * math.sin(rad))
            draw.line([(x1, y1), (x2, y2)], fill=(50, 180, 50), width=3)
            # Arrow tip
            tip_rad = math.radians(angle + 180)
            # draw simple dot at tip for simplicity
            draw.ellipse([(x2-3, y2-3), (x2+3, y2+3)], fill=(50, 180, 50))
            
    elif word == "introvertedly":
        # Arrows pointing inward
        for angle in range(0, 360, 45):
            rad = math.radians(angle)
            x1 = int(64 + 48 * math.cos(rad))
            y1 = int(64 + 48 * math.sin(rad))
            x2 = int(64 + 15 * math.cos(rad))
            y2 = int(64 + 15 * math.sin(rad))
            draw.line([(x1, y1), (x2, y2)], fill=(50, 50, 180), width=3)
            draw.ellipse([(x2-3, y2-3), (x2+3, y2+3)], fill=(50, 50, 180))
            
    elif word == "loquaciously":
        # Big speech bubble with tiny bubbles
        draw.ellipse([(20, 20), (108, 90)], outline=(0, 0, 0), fill=(255, 255, 255), width=2)
        draw.polygon([(40, 85), (30, 110), (60, 89)], fill=(255, 255, 255), outline=(0, 0, 0))
        # Draw tiny bubbles inside
        draw.ellipse([(34, 40), (44, 50)], fill=(0, 0, 0))
        draw.ellipse([(54, 45), (64, 55)], fill=(0, 0, 0))
        draw.ellipse([(74, 40), (84, 50)], fill=(0, 0, 0))
        draw.ellipse([(44, 60), (54, 70)], fill=(0, 0, 0))
        draw.ellipse([(64, 65), (74, 75)], fill=(0, 0, 0))
        
    elif word == "taciturnly":
        # Speech bubble with lock
        draw.ellipse([(20, 20), (108, 90)], outline=(0, 0, 0), fill=(255, 255, 255), width=2)
        draw.polygon([(40, 85), (30, 110), (60, 89)], fill=(255, 255, 255), outline=(0, 0, 0))
        # lock icon
        draw.rectangle([(54, 50), (74, 70)], fill=(50, 50, 50))
        draw.arc([(58, 38), (70, 50)], 180, 360, fill=(50, 50, 50), width=3)
        
    elif word == "verbosely":
        # Page packed with tiny lines of text
        draw.rectangle([(24, 15), (104, 113)], outline=(0, 0, 0), fill=(255, 255, 255), width=2)
        for y in range(25, 105, 6):
            draw.line([(34, y), (94, y)], fill=(100, 100, 100), width=2)
            
    else:
        # Fallback simple shape
        draw.ellipse([(34, 34), (94, 94)], fill=(120, 120, 120))
        
def generate_images():
    if not os.path.exists(IMAGE_DIR):
        os.makedirs(IMAGE_DIR)
        
    new_entries = []
    
    for grid_num in [17, 18, 19, 20]:
        words_info = GRIDS_C[grid_num]
        for level, word, desc in words_info:
            # Create a 128x128 image with a solid white background
            img = Image.new("RGB", (128, 128), color=(255, 255, 255))
            draw = ImageDraw.Draw(img)
            
            draw_icon(draw, word)
            
            # Save filename e.g. c1-paradox.jpg
            lvl_lower = level.lower()
            filename = f"{lvl_lower}-{word.replace(' ', '_')}.jpg"
            out_path = os.path.join(IMAGE_DIR, filename)
            
            img.save(out_path, "JPEG", quality=95)
            print(f"Programmatically generated clean icon for: {filename}")
            
            new_entries.append((level, word, f"images/{filename}"))
            
    # Import update_image_vocab from process_grids
    try:
        import sys
        sys.path.append(os.path.join(ROOT, "tools"))
        from process_grids import update_image_vocab
        update_image_vocab(new_entries)
    except Exception as e:
        print(f"Error updating vocab JSON: {e}")

if __name__ == "__main__":
    generate_images()
