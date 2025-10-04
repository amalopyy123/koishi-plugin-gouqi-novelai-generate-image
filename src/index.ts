import { Context, Schema, h, SessionError, segment, arrayBufferToBase64 } from "koishi"
import AdmZip from 'adm-zip'

export const name = 'gouqi-novelai-generate-image'


export interface Config {
  rpxy_url: string,
  token: string,
  model: any,
  additional_prompt: string,
  negative_prompt: string,
  steps: number,
  strength: any,
  allow_image: boolean,
  collapse_response: boolean,
  translate_model: any
}

export const Config: Schema<Config> = Schema.intersect([Schema.object({
  rpxy_url: Schema.string().default('https://image.novelai.net/ai/generate-image').description('反代地址'),
  token: Schema.string().default('').role("secret").description('token'),
  model: Schema.union(['nai-diffusion-3', 'nai-diffusion-4-full'] as const).role('radio').default('nai-diffusion-4-full').description("model"),
  additional_prompt: Schema.string().default('masterpiece, best quality, ultra-detailed, extremely detailed, best quality, best anatomy').description('附加提示词'),
  negative_prompt: Schema.string().default('owres, bad anatomy, bad hands, text, error, (missing fingers), extra digit, fewer digits, cropped, worst quality, low quality, signature, watermark, username, long neck, Humpbacked, bad crotch, bad crotch seam, fused crotch, fused seam, poorly drawn crotch, poorly drawn crotch seam, bad thigh gap, missing thigh gap, fused thigh gap, bad anatomy, short arm, (((missing arms))), missing thighs, missing calf, mutation, duplicate, more than 1 left hand, more than 1 right hand, deformed, (blurry), missing legs, extra arms, extra thighs, more than 2 thighs, extra calf, fused calf, extra legs, bad knee, extra knee, more than 2 legs').description('负面提示词'),
  steps: Schema.number().default(28).description('步数,28是免费，报错的话要调到28以上'),
  strength: Schema.tuple([Schema.number().default(0.88), Schema.number().default(0.93)]).description('strength，越高ai发挥的空间就越多'),
  allow_image: Schema.boolean().default(true).description('是否允许图生图'),
  collapse_response: Schema.boolean().default(true).description('折叠回复'),
  translate_model: Schema.union(['none', 'default_translator', 'translator_yd'] as const).role('radio').default('none').description("翻译模型")
}).description("画图设置")]);

export const inject = {
  required: ['http', 'gouqi_base'],
  optional: ['translator']
};

function forceDataPrefix(url, mime = "image/png") {
  if (url.startsWith("data:")) return url;
  return `data:${mime};base64,` + url;
}
var ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];
//10M
var MAX_CONTENT_SIZE = 10485760;
async function downloadImage(ctx, url, headers = {}) {

  const image = await ctx.http(url, { responseType: "arraybuffer", headers });
  if (+image.headers.get("content-length") > MAX_CONTENT_SIZE) {
    throw new Error(".file-too-large");
  }
  const mimetype = image.headers.get("content-type");
  if (!ALLOWED_TYPES.includes(mimetype)) {
    throw new Error(".unsupported-file-type");
  }
  const buffer = image.data;
  const base64 = arrayBufferToBase64(buffer);
  return { buffer, base64, dataUrl: `data:${mimetype};base64,${base64}` };
}

export function apply(ctx: Context, config) {

  function initParams() {
    let paramsTextToImg, paramsImgToImg, paramsTextToImgV4, paramsImgToImgV4;
    // 注意为了重置随机数，apply之应用一次
    paramsTextToImg = {
      input: 'octopus, best quality, amazing quality, very aesthetic, absurdres',
      model: 'nai-diffusion-3',
      action: 'generate',
      parameters: {
        params_version: 1,
        width: 1024,
        height: 1024,
        scale: 5,
        sampler: 'k_euler',
        steps: 28,
        n_samples: 1,
        ucPreset: 2,
        qualityToggle: false,
        sm: true,
        sm_dyn: true,
        dynamic_thresholding: true,
        controlnet_strength: 1,
        legacy: false,
        add_original_image: false,
        cfg_rescale: 0.18,
        noise_schedule: 'native',
        skip_cfg_above_sigma: 19.343056794463642,
        legacy_v3_extend: false,
        seed: Math.floor(Math.random() * 1000000),
        negative_prompt: 'NSFW, bad proportions, out of focus, username, text, bad anatomy, lowres, worstquality, watermark, cropped, bad body, deformed, mutated, disfigured, poorly drawn face, malformed hands, extra arms, extra limb, missing limb, too many fingers, extra legs, bad feet, missing fingers, fused fingers, acnes, floating limbs, disconnected limbs, long neck, long body, mutation, ugly, blurry, low quality, sketches, normal quality, monochrome, grayscale, signature, logo, jpeg artifacts, unfinished, displeasing, chromatic aberration, extra digits, artistic error, scan, abstract, photo, realism, screencap',
        reference_image_multiple: [],
        reference_information_extracted_multiple: [],
        reference_strength_multiple: [],
        prompt: 'octopus, best quality, amazing quality, very aesthetic, absurdres',
        uc: 'nsfw, lowres, {bad}, error, fewer, extra, missing, worst quality, jpeg artifacts, bad quality, watermark, unfinished, displeasing, chromatic aberration, signature, extra digits, artistic error, username, scan, [abstract]',
        image: undefined
      }
    }
    paramsImgToImg = {
      model: 'nai-diffusion-3',
      action: 'img2img',
      input: 'marisa kirisame, best quality, amazing quality, very aesthetic, absurdres',
      parameters: {
        width: 1024,
        height: 1024,
        scale: 6,
        sampler: 'k_euler_ancestral',
        steps: 28,
        seed: Math.floor(Math.random() * 1000000),
        n_samples: 1,
        ucPreset: 0,
        qualityToggle: true,
        negative_prompt: "nsfw, nude, nudity, lowres, bad anatomy, bad hands, text, error, missing fingers, extra digit, fewer digits, cropped, worst quality, low quality, signature, watermark, username, blurry",
        add_original_image: false,
        controlnet_strength: 0.6,
        dynamic_thresholding: false,
        extra_noise_seed: Math.floor(Math.random() * 1000000000),
        legacy: false,
        noise: 0,
        sm: false,
        sm_dyn: false,
        strength: 0.58,
        image: undefined
      }
    }
    paramsTextToImgV4 = {
      input: 'octopus, best quality, amazing quality, very aesthetic, absurdres',
      model: 'nai-diffusion-4-full',
      action: 'generate',
      parameters: {
        params_version: 1,
        width: 1024,
        height: 1024,
        scale: 5,
        sampler: 'k_euler',
        steps: 28,
        n_samples: 1,
        ucPreset: 3,
        qualityToggle: false,
        dynamic_thresholding: true,
        controlnet_strength: 1,
        legacy: false,
        add_original_image: false,
        cfg_rescale: 0.18,
        noise_schedule: 'native',
        skip_cfg_above_sigma: 19.343056794463642,
        legacy_v3_extend: false,
        seed: Math.floor(Math.random() * 1000000),
        negative_prompt: 'NSFW, bad proportions, out of focus, username, text, bad anatomy, lowres, worstquality, watermark, cropped, bad body, deformed, mutated, disfigured, poorly drawn face, malformed hands, extra arms, extra limb, missing limb, too many fingers, extra legs, bad feet, missing fingers, fused fingers, acnes, floating limbs, disconnected limbs, long neck, long body, mutation, ugly, blurry, low quality, sketches, normal quality, monochrome, grayscale, signature, logo, jpeg artifacts, unfinished, displeasing, chromatic aberration, extra digits, artistic error, scan, abstract, photo, realism, screencap',
        reference_image_multiple: [],
        reference_information_extracted_multiple: [],
        reference_strength_multiple: [],
        use_coords: false,
        characterPrompts: [],
        v4_prompt: {},
        v4_negative_prompt: {}
      }
    }
    paramsTextToImgV4.parameters.v4_prompt = {
      caption: { base_caption: paramsTextToImgV4.input, char_captions: [] },
      use_coords: false,
      use_order: true,
    };
    paramsTextToImgV4.parameters.v4_negative_prompt = {
      caption: {
        base_caption: paramsTextToImgV4.parameters.negative_prompt,
        char_captions: [],
      }
    };

    paramsImgToImgV4 = {
      model: 'nai-diffusion-4-full',
      action: 'img2img',
      input: 'marisa kirisame, best quality, amazing quality, very aesthetic, absurdres',
      parameters: {
        width: 768,
        height: 768,
        scale: 6,
        sampler: 'k_euler_ancestral',
        steps: 28,
        seed: Math.floor(Math.random() * 1000000),
        n_samples: 1,
        ucPreset: 0,
        qualityToggle: true,
        negative_prompt: "nsfw, nude, nudity, lowres, bad anatomy, bad hands, text, error, missing fingers, extra digit, fewer digits, cropped, worst quality, low quality, signature, watermark, username, blurry",
        add_original_image: true,
        controlnet_strength: 0.1,
        dynamic_thresholding: false,
        extra_noise_seed: Math.floor(Math.random() * 1000000000),
        legacy: false,
        noise: 0.1,
        strength: 0.8,
        image: undefined,
        v4_prompt: {},
        v4_negative_prompt: {}
      }
    }
    paramsImgToImgV4.parameters.v4_prompt = {
      caption: { base_caption: paramsImgToImgV4.input, char_captions: [] },
      use_coords: false,
      use_order: true,
    };
    paramsImgToImgV4.parameters.v4_negative_prompt = {
      caption: {
        base_caption: paramsImgToImgV4.parameters.negative_prompt,
        char_captions: [],
      }
    };
    return {
      paramsTextToImg: paramsTextToImg, paramsImgToImg: paramsImgToImg,
      paramsTextToImgV4: paramsTextToImgV4, paramsImgToImgV4: paramsImgToImgV4
    }
  }



  async function generateImage({ session, options: options2 }, input) {
    // 重置随机数
    let initObj = initParams();
    let paramsTextToImg = initObj['paramsTextToImg'];
    let paramsImgToImg = initObj['paramsImgToImg'];
    let paramsTextToImgV4 = initObj['paramsTextToImgV4'];
    let paramsImgToImgV4 = initObj['paramsImgToImgV4'];
    try {
      if (!config.token) {
        return '没有token';
      }
      if (ctx['gouqi_base'].hasSensitiveWords(input)) {
        //提时含有敏感词
        const bot = session.bot;
        try {
          const data2 = await bot.internal.getStrangerInfo(session.userId);
          session.send("不可以涩涩！打屎" + data2.nickname + "!!!");
        } catch (error) {
          session.send("不可以涩涩！");
        }
        return;
      }
      if (!config.allow_image && h.select(input, 'img').length) {
        throw new SessionError("不允许输入图片");
      }
      let textMerged = ctx['gouqi_base'].getMergedText(input);
      if (config.translate_model == 'default_translator') {
        if (session.app['translator']) {
          try {
            textMerged = await session.app['translator'].translate({ textMerged, target: "en" });
            //console.log("翻译后的提示词");
            //console.log(input);
          } catch (err) {
            ctx.logger.warn(err);
          }
        }
      } else if (config.translate_model == 'translator_yd') {
        if (ctx['gouqi_base'].hasChinese(textMerged)) {
          textMerged = await ctx['gouqi_base'].translate_yd(textMerged);
        }
      }

      let imgUrl, image;
      let imgList = h.select(input, 'img').map((item) => h.image(item.attrs.src));
      // [
      //   Element {
      //     type: 'img',
      //     attrs: {
      //       src: 'https://multimedia.nt.qq.com.cn/download?appid=1406&fileid=EhRwxouxV1q0QM3vKzMZBDm-6dA1axjVwBMg_goo5sKMiJqMjAMyBHByb2RaEAvhqxttZhG5Z27_F0omrts&rkey=CAISKHim-nm2GSiHwTEFcDcvzmG7hrTpkLa_daXUa7hZaWXDCTu8QnI3ZI0'
      //     },
      //     children: []
      //   }
      // ]
      //console.log(imgList);
      let atList = h.select(input, 'at').map((item) => h.text(item.attrs.id));
      if (imgList.length) {
        imgUrl = imgList[0].attrs.src;
        try {
          image = await downloadImage(ctx, imgUrl);
          //console.log(image.base64)
        } catch (err) {
          ctx.logger.error(err);
          return 'Download error';
        }
      } else if (atList.length) {
        try {
          let atId = atList[0];
          image = await ctx['gouqi_base'].getAvatar64(atId);
        } catch (err) {
          ctx.logger.error(err);
          return 'Download error';
        }
      }
      let textPromt = textMerged;
      session.send("很快很快...");
      let paramsToSend;
      if (config.model == 'nai-diffusion-4-full') {
        //v4
        if (image) {
          paramsToSend = paramsImgToImgV4;
          paramsToSend.parameters.image = image?.base64;
        } else {
          paramsToSend = paramsTextToImgV4;
        }
        //prompt
        paramsToSend.input = textPromt + ',' + config.additional_prompt;
        //negative_prompt
        paramsToSend.negative_prompt = config.negative_prompt;
        paramsToSend.parameters.steps = config.steps;
        //strength
        let strength = config.strength[0] + Math.random() * (config.strength[1] - config.strength[0]);
        paramsToSend.parameters.strength = parseFloat(strength.toFixed(3));
        if (options2.hasOwnProperty('s')) {
          paramsToSend.parameters.strength = parseFloat(options2.s);
        }
        if (options2.hasOwnProperty('strength')) {
          paramsToSend.parameters.strength = parseFloat(options2.strength);
        }
        ctx.logger.info('strength: ' + paramsToSend.parameters.strength);
        paramsToSend.parameters.v4_prompt = {
          caption: { base_caption: paramsToSend.input, char_captions: [] },
          use_coords: false,
          use_order: true,
        };
        paramsToSend.parameters.v4_negative_prompt = {
          caption: {
            base_caption: paramsToSend.parameters.negative_prompt,
            char_captions: [],
          }
        };
      } else {
        //v3
        if (image) {
          paramsToSend = paramsImgToImg;
          paramsToSend.parameters.image = image?.base64;
        } else {
          paramsToSend = paramsTextToImg;
        }

        //prompt
        paramsToSend.input = textPromt + ',' + config.additional_prompt;
        //negative_prompt
        paramsToSend.negative_prompt = config.negative_prompt;
        paramsToSend.parameters.steps = config.steps;
        //strength
        let strength = config.strength[0] + Math.random() * (config.strength[1] - config.strength[0]);
        paramsToSend.parameters.strength = parseFloat(strength.toFixed(3));
        if (options2.hasOwnProperty('s')) {
          paramsToSend.parameters.strength = parseFloat(options2.s);
        }
        if (options2.hasOwnProperty('strength')) {
          paramsToSend.parameters.strength = parseFloat(options2.strength);
        }
        ctx.logger.info('strength: ' + paramsToSend.parameters.strength);
      }

      const headers = {
        Authorization: `Bearer ${config.token}`
      };
      // console.log("headers to post:");
      // console.log(headers);
      // console.log("body to post:");
      // console.log(paramsToSend);
      try {
        const res = await ctx.http(
          config.rpxy_url,
          {
            method: "POST",
            //timeout: config.requestTimeout,
            timeout: 990000,
            // Since novelai's latest interface returns an application/x-zip-compressed, a responseType must be passed in
            //responseType: config.type === "naifu" ? "text" : ["login", "token"].includes(config.type) ? "arraybuffer" : "json",
            responseType: "arraybuffer",
            headers: headers,
            data: paramsToSend,
          }
        );
        //console.log(res.headers.get("content-type"));
        if (res.headers.get('content-type') === 'application/x-zip-compressed' ||
          res.headers.get('content-disposition')?.includes('.zip')) {
          const buffer = Buffer.from(res.data) // Ensure 'binary' encoding
          const zip = new AdmZip(buffer)

          // Gets all files in the ZIP file
          const zipEntries = zip.getEntries()
          const firstImageBuffer = zip.readFile(zipEntries[0])
          const b64 = firstImageBuffer.toString('base64');
          let mimeType = "image/png";
          const base64Url = `data:${mimeType};base64,${b64}`;
          if (!config.collapse_response) {
            return segment.image(base64Url);
          }
          const result = h('figure');
          const attrs = {
            userId: session.userId,
            nickname: session.author?.nickname || session.username,
          }
          result.children.push(h('message', attrs, 'prompts: ' + paramsToSend.input));
          //result.children.push(h('message', attrs, 'negative_prompt: ' + paramsToSend.negative_prompt));
          result.children.push(h('message', attrs, segment.image(base64Url)));
          await session.send(result);
        } else {
          throw new Error('Unsupported header');
        }
      }
      catch (error) {
        ctx.logger.error(error)
        return "发生错误: " + error.message;
      }
    } catch (error) {
      ctx.logger.error(error);
      session.send("发生错误");
    }
  }
  ctx
    .command("nai-img <prompts:text>")
    .alias("设计")
    .action(async ({ session, options: options2 }, input) => {
      return generateImage({ session, options: options2 }, input)
    }
    );

  ctx
    .command('反正就是一个指令')
    .action(async ({ session }) => {
      await session.send('请输入标题')
      const title = await session.prompt(20000);
      if (!title || !title.trim()) return `粗口`
      await session.send('请输入图片');
      const img = h.select(await session.prompt(20000) || '', 'img').map(img => img.attrs.src);
      if (!img.length) return `粗口`
      ctx.logger.error(img);
      return h.image(img[0]) + title
    }
    );
}