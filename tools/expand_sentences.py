# -*- coding: utf-8 -*-
import json
import sys

# 200+ simple, colloquial spoken sentences across 3 themes:
# 1. 日常問候與道別
# 2. 社交閒聊與介紹
# 3. 購物消費與結帳

new_greetings = [
    ("How are you doing today?", "你今天好嗎？"),
    ("How have you been?", "你最近過得如何？"),
    ("How's everything going with you?", "你一切都還順利嗎？"),
    ("How's life treating you?", "最近日子過得怎麼樣？"),
    ("What are you up to these days?", "你這陣子在忙些什麼？"),
    ("Good to see you again!", "很高興又見到你了！"),
    ("It's been a while, hasn't it?", "好久不見了，對吧？"),
    ("Long time no talk!", "好久沒跟你聊天了！"),
    ("How's your morning going?", "你今天早上過得好嗎？"),
    ("How was your weekend?", "你週末過得如何？"),
    ("Did you do anything fun over the weekend?", "你週末有去哪裡玩嗎？"),
    ("What's new with you?", "你最近有什麼新鮮事嗎？"),
    ("Not much, just the usual.", "沒什麼特別的，就跟平常一樣。"),
    ("Same old, same old.", "老樣子，沒什麼變。"),
    ("I'm doing pretty well, thanks!", "我過得很不錯，謝謝！"),
    ("Couldn't be better!", "好得不能再好了！"),
    ("I've been a bit busy lately.", "我最近稍微有點忙。"),
    ("I'm hanging in there.", "我還撐得住／還過得去。"),
    ("Things are going great!", "一切都很順利！"),
    ("How are things at home?", "家裡一切都還好嗎？"),
    ("How's work treating you?", "工作上還順利嗎？"),
    ("Are you having a good day?", "你今天過得開心嗎？"),
    ("I hope you're having a wonderful day.", "希望你今天過得很美好。"),
    ("Morning! Did you sleep well?", "早安！昨晚睡得好嗎？"),
    ("Good afternoon, how's your day going so far?", "午安，今天到目前為止過得如何？"),
    ("Good evening! How was your day?", "晚上好！今天過得好嗎？"),
    ("Have a great day ahead!", "祝你有個美好的一天！"),
    ("Enjoy the rest of your day!", "好好享受今天剩下的時光！"),
    ("Have a good one!", "祝你順心！／祝你今天愉快！"),
    ("Take care of yourself!", "好好照顧自己喔！"),
    ("Stay safe and healthy!", "保持安全健康喔！"),
    ("Keep in touch, okay?", "保持聯絡喔，好嗎？"),
    ("Let's keep in touch!", "我們常保持聯絡吧！"),
    ("I'll see you tomorrow.", "明天見囉。"),
    ("See you later today.", "今天晚點見。"),
    ("Catch you later!", "晚點再聊！／回頭見！"),
    ("Talk to you soon!", "下次再聊囉！"),
    ("I have to run now.", "我現在得趕快走了。"),
    ("I've got to get going.", "我該出發動身了。"),
    ("I must be off now.", "我該先離開了。"),
    ("It was so nice catching up with you.", "今天能和你敘敘舊真好。"),
    ("I'm really glad we bumped into each other.", "真高興今天能遇到你。"),
    ("Say hi to your family for me.", "替我向你的家人問好。"),
    ("Give my best to everyone.", "幫我向大家致意問候。"),
    ("Have a safe trip home!", "回家路上小心喔！"),
    ("Get home safe!", "平安到家喔！"),
    ("Have a wonderful weekend!", "祝你有個美好的週末！"),
    ("Enjoy your holiday!", "祝你假期愉快！"),
    ("Sleep tight!", "睡個好覺喔！／晚安！"),
    ("Sweet dreams!", "祝你好夢！"),
    ("See you in a bit!", "待會兒見！"),
    ("Until next time!", "下次見囉！"),
    ("Take it easy!", "放輕鬆點！／別太累喔！"),
    ("Peace out!", "再會啦！／走了喔！"),
    ("Have fun today!", "今天玩得開心點！"),
    ("Best of luck today!", "祝你今天一切順利！"),
    ("Fingers crossed for you!", "為你祈求好運！"),
    ("I'll drop you a text later.", "我晚點傳簡訊給你。"),
    ("Call me when you get there.", "你到了之後打給我。"),
    ("Let me know when you get home.", "你到家跟我說一聲。"),
    ("Take care on your way out.", "離開路上小心走喔。"),
    ("Have a safe flight!", "祝你飛行平安順利！"),
    ("Welcome back!", "歡迎回來！"),
    ("Make yourself at home.", "請當作自己家，別客氣。"),
    ("It's great to have you here.", "很高興你能來這裡。"),
    ("Thanks for dropping by!", "謝謝你順道過來坐坐！"),
    ("Come visit again soon!", "有空隨時再來玩喔！"),
    ("Nice talking to you as always.", "一如往常，跟你聊天總是很開心。"),
    ("Have a productive day!", "祝你有個充實又有收穫的一天！"),
    ("See you bright and early tomorrow!", "明天大清早見！"),
    ("How's your evening going?", "你今晚過得如何？"),
    ("I hope everything is fine with you.", "希望你一切都安好。"),
    ("Glad to catch you before you leave.", "真高興在你離開前遇到你。"),
    ("Wish you all the very best.", "祝你一切順心如意。"),
    ("Catch up with you next week.", "我們下週再聯絡敘舊。")
]

new_chat = [
    ("What are you up to right now?", "你現在在忙些什麼呀？"),
    ("Are you free this weekend?", "你這週末有空嗎？"),
    ("Do you have any plans for tonight?", "你今晚有什麼安排嗎？"),
    ("What do you like to do in your free time?", "你平常休閒時喜歡做什麼？"),
    ("Do you have any hobbies?", "你有什麼特別的興趣愛好嗎？"),
    ("I really like listening to music and watching movies.", "我很喜歡聽音樂和看電影。"),
    ("Have you seen any good movies lately?", "你最近有看什麼好看的電影嗎？"),
    ("What kind of music are you into?", "你喜歡聽哪一種類型的音樂？"),
    ("The weather is so lovely today, isn't it?", "今天天氣真舒服，對吧？"),
    ("It looks like it's going to rain soon.", "看起來好像快要下雨了。"),
    ("I hope the weather stays nice this weekend.", "希望這週末天氣能一直這麼好。"),
    ("It's pretty hot today, don't you think?", "今天滿熱的，你不覺得嗎？"),
    ("I can't stand the cold weather.", "我真的很受不了寒冷的天氣。"),
    ("What's your favorite season of the year?", "一年當中你最喜歡哪個季節？"),
    ("Where did you grow up?", "你是在哪裡長大的？"),
    ("How long have you been living here?", "你在這裡住了多久了？"),
    ("What brought you to this city?", "是什麼機緣讓你來到這座城市的？"),
    ("Do you live around here?", "你就住在這附近嗎？"),
    ("Is this your first time coming here?", "這是你第一次來這裡嗎？"),
    ("How do you two know each other?", "你們兩位是怎麼認識的？"),
    ("We've been friends since college.", "我們從大學時代就是好朋友了。"),
    ("We work at the same company.", "我們在同一家公司上班。"),
    ("What line of work are you in?", "你是從事哪一行的？"),
    ("I work in marketing and design.", "我從事行銷與設計相關工作。"),
    ("How do you like your current job?", "你喜歡你目前這份工作嗎？"),
    ("It's quite challenging, but I enjoy it.", "滿有挑戰性的，不過我做得很開心。"),
    ("Are you working on any interesting projects?", "你最近有在做什麼有趣的專案嗎？"),
    ("That sounds really exciting!", "那聽起來真的很令人興奮！"),
    ("Tell me more about it!", "多跟我聊聊這個吧！"),
    ("I know exactly what you mean.", "我完全懂你的意思。"),
    ("That makes a lot of sense.", "那確實非常有道理。"),
    ("I couldn't agree with you more.", "我完全贊同你的看法。"),
    ("That's a good point.", "這點說得很對／是個好觀點。"),
    ("I hadn't thought of it that way.", "我之前還真沒這樣想過。"),
    ("No way! Are you serious?", "不會吧！你是認真的嗎？"),
    ("You've got to be kidding me!", "你一定是在跟我開玩笑吧！"),
    ("I'm so happy for you!", "我真替你感到開心！"),
    ("Congratulations on your good news!", "恭喜你傳出好消息！"),
    ("That's too bad, I'm sorry to hear that.", "那太遺憾了，聽到這件事很替你難過。"),
    ("Don't worry about it too much.", "別為那件事太過煩惱啦。"),
    ("Everything will turn out fine in the end.", "到最後一切都會好轉的。"),
    ("Cheer up! Tomorrow is a new day.", "振作點！明天又是全新的一天。"),
    ("If you ever want to talk, I'm always here.", "如果你想找人聊聊，我隨時都在。"),
    ("Thanks for listening to me vent.", "謝謝你願意聽我吐苦水。"),
    ("You're such a great listener.", "你真的是個很棒的傾聽者。"),
    ("Let's grab a cup of coffee sometime.", "我們找個時間一起去喝杯咖啡吧。"),
    ("Are you up for getting some lunch together?", "想不想一起去吃個午餐？"),
    ("That sounds like a great plan!", "那聽起來是個很棒的提議！"),
    ("I'd love to, count me in!", "我很想去，算我一份！"),
    ("Let me check my calendar first.", "我先看一下我的行事曆確認一下。"),
    ("I might be busy, but I'll let you know.", "我那時可能有點事，但我會再通知你。"),
    ("Can we take a rain check on that?", "這次我們可以先改期改天嗎？"),
    ("Sure, whatever works best for you.", "好啊，看你什麼時候最方便都行。"),
    ("I'm looking forward to our next get-together.", "我很期待我們下次的聚會。"),
    ("It was great chatting with you today.", "今天能跟你聊天真開心。"),
    ("You have a really good sense of humor.", "你真的很有幽默感耶。"),
    ("You always know how to make people laugh.", "你總是知道怎麼逗大家笑。"),
    ("I really admire your positive attitude.", "我真的很欣賞你樂觀正向的態度。"),
    ("Thank you, that means a lot to me.", "謝謝你，這對我來說意義重大。"),
    ("Don't mention it, it's my pleasure.", "別客氣，這是我的榮幸。"),
    ("By the way, did you hear the news today?", "順帶一提，你有看到今天的新聞嗎？"),
    ("Speaking of travel, have you been abroad lately?", "說到旅遊，你最近有出國嗎？"),
    ("I'm planning a short trip next month.", "我正計畫下個月去趟短途旅行。"),
    ("That sounds like a lot of fun!", "那聽起來一定超好玩的！"),
    ("Hope you have an awesome time there!", "希望你在那裡玩得非常盡興！"),
    ("What kind of food do you like to eat?", "你平常喜歡吃哪種料理？"),
    ("Do you like spicy food?", "你敢吃辣嗎？"),
    ("There is a great new cafe nearby.", "這附近開了一家很棒的新咖啡館。"),
    ("We should definitely check it out.", "我們改天一定要去朝聖看看。"),
    ("I totally agree with what you just said.", "我完全同意你剛剛說的話。")
]

new_shopping = [
    ("How much does this item cost?", "這件商品多少錢呢？"),
    ("Is there any discount on this product?", "這項商品目前有任何折扣優惠嗎？"),
    ("Can I get a student discount?", "請問有提供學生優惠折扣嗎？"),
    ("Is this on sale right now?", "這個現在有在特價嗎？"),
    ("Buy one, get one fifty percent off.", "買一件，第二件享五折優惠。"),
    ("Do you have this in a larger size?", "這個有大一點的尺寸嗎？"),
    ("Do you carry this in a size medium?", "這款有 M 號的嗎？"),
    ("Do you have this in any other colors?", "這款還有其他顏色可以選嗎？"),
    ("I'm looking for a black jacket.", "我想找一件黑色的外套。"),
    ("Where can I find the fitting rooms?", "請問試衣間在哪個方向呢？"),
    ("Can I try this shirt on?", "我可以試穿這件襯衫嗎？"),
    ("The fitting rooms are right over there.", "試衣間就在那邊轉角處。"),
    ("How does it look on me?", "這件穿在我身上好看嗎？"),
    ("It fits you really well!", "這件非常適合你，很合身！"),
    ("I think it's a bit too tight for me.", "我覺得對我來說有點太緊了。"),
    ("Do you have something a bit looser?", "你有更寬鬆一點的款式嗎？"),
    ("This size is just right.", "這個尺寸剛剛好。"),
    ("I really like the material of this dress.", "我很喜歡這件洋裝的材質。"),
    ("Is this made of real leather?", "請問這是真皮做的嗎？"),
    ("How should I wash this fabric?", "這種布料應該怎麼清洗呢？"),
    ("I'm just browsing, thank you!", "我只是先隨便看看，謝謝您！"),
    ("Let me know if you need any help.", "如果您需要任何協助，隨時跟我說。"),
    ("Could you help me reach that top shelf?", "您可以幫我拿一下最上面那層的商品嗎？"),
    ("Is this item currently in stock?", "這件商品目前店裡有現貨嗎？"),
    ("I'm sorry, it's currently out of stock.", "非常抱歉，這個目前缺貨中。"),
    ("When do you expect the new stock to arrive?", "請問新的一批貨預計什麼時候會到？"),
    ("Can you hold this item for me until tomorrow?", "可以幫我把這件商品保留到明天嗎？"),
    ("Where is the checkout counter?", "請問結帳櫃台在哪裡？"),
    ("Are you ready to check out?", "請問您準備好要結帳了嗎？"),
    ("Are you waiting in line?", "請問您是在排隊嗎？"),
    ("The line starts back there, sir.", "先生，排隊隊伍是從後面開始的喔。"),
    ("Would you like a shopping bag for that?", "請問您需要加購購物袋嗎？"),
    ("I brought my own reusable bag, thanks.", "我自己有帶環保購物袋，謝謝。"),
    ("How would you like to pay today?", "請問您今天打算如何付款呢？"),
    ("I'll pay with cash, please.", "我用現金付款，謝謝。"),
    ("Can I pay by credit card?", "請問我可以刷信用卡嗎？"),
    ("Do you accept contactless payments like Apple Pay?", "請問你們支援 Apple Pay 等感應式行動支付嗎？"),
    ("Please tap or insert your card here.", "請在此處感應或插入您的卡片。"),
    ("Please enter your PIN on the keypad.", "請在密碼鍵盤上輸入您的個人密碼。"),
    ("Could you sign your name here, please?", "麻煩請您在這裡簽個名。"),
    ("Here is your receipt and change.", "這是您的收據和找零。"),
    ("Keep the change, thank you.", "不用找零了，謝謝。"),
    ("Can I get a receipt, please?", "可以給我一張收據／發票嗎？"),
    ("Can I get a gift receipt for this?", "可以給我一張禮品收據（不含金額）嗎？"),
    ("Would you like this gift-wrapped?", "請問您需要將這個包裝成禮物嗎？"),
    ("What is your store's return policy?", "請問貴店的退換貨規定是什麼？"),
    ("Can I return this if it doesn't fit?", "如果尺寸不合，我可以拿回來退貨嗎？"),
    ("You can return it within thirty days with the receipt.", "憑發票可以在三十天內辦理退換貨。"),
    ("Please make sure the tags are still attached.", "請務必確保商品的吊牌未拆除。"),
    ("I would like to exchange this for a different color.", "我想把這件更換成別的顏色。"),
    ("I'd like to get a refund for this purchase.", "我想申請這筆消費的全額退款。"),
    ("Is there anything wrong with the product?", "請問這件商品有任何瑕疵或問題嗎？"),
    ("It was defective right out of the box.", "剛拆開包裝就發現它有瑕疵破損。"),
    ("We're happy to replace it for you right away.", "我們非常樂意立刻為您更換一件全新的。"),
    ("Do you have a membership card with us?", "請問您有我們店裡的會員卡嗎？"),
    ("Can I use my reward points for this purchase?", "我這次結帳可以使用我的會員點數折抵嗎？"),
    ("Would you like to sign up for our free membership?", "您想免費註冊加入我們的會員嗎？"),
    ("You can earn points with every purchase.", "每次消費都可以累積點數換優惠喔。"),
    ("Here is your membership barcode on the app.", "這是我手機 App 上的會員條碼。"),
    ("That comes to fifty dollars in total.", "全部一共是五十元。"),
    ("Is tax included in the price?", "請問標價裡面已經包含稅金了嗎？"),
    ("This item has a one-year warranty.", "這項商品附有一年的原廠保固。"),
    ("Thank you for shopping with us, have a wonderful day!", "謝謝您的光臨購物，祝您有美好的一天！"),
    ("Please come again soon!", "歡迎下次再度光臨！"),
    ("Enjoy your new purchase!", "祝您使用新買的寶貝開心滿意！"),
    ("Is this available online as well?", "這款在網路商店也有販售嗎？"),
    ("Do you offer free home delivery?", "你們有提供免費宅配到府服務嗎？"),
    ("Can I have a paper bag instead?", "可以改給我紙袋嗎？"),
    ("Is there a warranty on electronic items?", "電子產品有附保固嗎？"),
    ("Here is your copy of the receipt.", "這是您的收據聯。")
]

def main():
    with open('web/data/sentences_1000.json', 'r', encoding='utf-8') as f:
        existing = json.load(f)

    print(f"Loaded existing: {len(existing)} sentences")
    existing_ens = set(s['en'].strip().lower() for s in existing)

    added_list = []
    
    # 1. 日常問候與道別
    for en, zh in new_greetings:
        if en.strip().lower() not in existing_ens:
            added_list.append({
                "category": "日常問候與道別",
                "en": en,
                "zh": zh
            })
            existing_ens.add(en.strip().lower())
    
    # 2. 社交閒聊與介紹
    for en, zh in new_chat:
        if en.strip().lower() not in existing_ens:
            added_list.append({
                "category": "社交閒聊與介紹",
                "en": en,
                "zh": zh
            })
            existing_ens.add(en.strip().lower())

    # 3. 購物消費與結帳
    for en, zh in new_shopping:
        if en.strip().lower() not in existing_ens:
            added_list.append({
                "category": "購物消費與結帳",
                "en": en,
                "zh": zh
            })
            existing_ens.add(en.strip().lower())

    print(f"New candidate sentences collected: {len(added_list)}")
    
    # Take exactly 200 items to make total 1200
    if len(added_list) > 200:
        added_list = added_list[:200]
    
    total_data = []
    curr_id = 1
    for s in existing:
        total_data.append({
            "id": curr_id,
            "category": s.get("category", "常用句子"),
            "en": s["en"],
            "zh": s["zh"]
        })
        curr_id += 1
    
    for s in added_list:
        total_data.append({
            "id": curr_id,
            "category": s["category"],
            "en": s["en"],
            "zh": s["zh"]
        })
        curr_id += 1

    print(f"Final total sentences: {len(total_data)}")
    assert len(total_data) == 1200, f"Expected 1200 sentences, got {len(total_data)}"

    targets = [
        'web/data/sentences_1000.json',
        'data/sentences_1000.json',
        'web/sentences_1000.json',
        'sentences_1000.json'
    ]

    for path in targets:
        with open(path, 'w', encoding='utf-8') as out:
            json.dump(total_data, out, ensure_ascii=False, indent=2)
        print(f"Updated {path}")

if __name__ == '__main__':
    main()
