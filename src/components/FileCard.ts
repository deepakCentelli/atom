import { ProjectFile } from "../data/projects";


export function FileCard(
    file: ProjectFile,
    selected: boolean
) {


    return `


<div 
class="file-card ${selected ? "selected" : ""}"
data-file-id="${file.id}"
>

<div class="file-info">


<div class="file-icon ${file.type.toLowerCase()}">

    ${file.type}

</div>



<div>


<span class="file-date">
${file.date}
</span>



<h3>
${file.name}
</h3>



<p>
${file.description}
</p>


</div>


</div>




<div class="file-actions">


<button>
Edit
</button>


<button>
Copy
</button>


<button>
👁
</button>


<button>
Delete
</button>


</div>



</div>


`;

}