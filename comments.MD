<!-- Blog Exercise -->

<!-- import BlogPost from "./components/BlogPost.vue";

const posts = ref([
  { id: 1, title: "My little pony" },
  { id: 2, title: "This is my amazing gumball" },
  { id: 3, title: "Nomo arigato kakawaii" },
]);

const postFontSize = ref(1);

<div :style="{ fontSize: postFontSize + 'em' }">
    <BlogPost
      v-for="post in posts"
      :key="post.id"
      :title="post.title"
      @enlarge-text="postFontSize += 0.1"
    />
  </div>
-->

<!-- AlertBox -->

 <!-- 

import AlertBox from "./components/AlertBox.vue";

 <AlertBox>
    This is mama coco
  </AlertBox> -->

<!-- Tabs -->
<!-- 

import Home from "./components/Home.vue";
import Posts from "./components/Posts.vue";
import Archive from "./components/Archive.vue";

const currentTab = ref("Home");

const tabs = {
  Home,
  Posts,
  Archive,
};

<div class="demo">
    <button
      v-for="(_, tab) in tabs"
      :key="tab"
      :class="['tab-button', { active: currentTab === tab }]"
      @click="currentTab = tab"
    >
      {{ tab }}
    </button>
    <component :is="tabs[currentTab]" class="tab"></component>
  </div>

.demo {
font-family: sans-serif;
border: 1px solid #eee;
border-radius: 2px;
padding: 20px 30px;
margin-top: 1em;
margin-bottom: 40px;
user-select: none;
overflow-x: auto;
}

.tab-button {
padding: 6px 10px;
border-top-left-radius: 3px;
border-top-right-radius: 3px;
border: 1px solid #ccc;
cursor: pointer;
background: #f0f0f0;
margin-bottom: -1px;
margin-right: -1px;
}
.tab-button:hover {
background: #e0e0e0;
}
.tab-button.active {
background: #e0e0e0;
}
.tab {
border: 1px solid #ccc;
padding: 10px;
} -->
